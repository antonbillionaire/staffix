import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET - List insights for user's business
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user || user.businesses.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    const businessId = user.businesses[0].id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // new, accepted, dismissed
    const type = searchParams.get("type"); // faq_suggestion, popular_question, etc.

    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;
    if (type) where.type = type;

    const insights = await prisma.aiInsight.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Insights fetch error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// PATCH - Accept or dismiss insight
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user || user.businesses.length === 0) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json(
        { error: "id и status обязательны" },
        { status: 400 }
      );
    }

    if (status !== "accepted" && status !== "dismissed") {
      return NextResponse.json(
        { error: "status должен быть 'accepted' или 'dismissed'" },
        { status: 400 }
      );
    }

    // Verify insight belongs to user's business
    const existing = await prisma.aiInsight.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Инсайт не найден" }, { status: 404 });
    }

    const insight = await prisma.aiInsight.update({
      where: { id },
      data: { status },
    });

    // If accepted and type is faq_suggestion — auto-create FAQ from insight data
    if (status === "accepted" && existing.type === "faq_suggestion" && existing.data) {
      const data = existing.data as Record<string, string>;
      if (data.question && data.answer) {
        await prisma.fAQ.create({
          data: {
            question: data.question,
            answer: data.answer,
            businessId,
          },
        });
      }
    }

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("Insight update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
