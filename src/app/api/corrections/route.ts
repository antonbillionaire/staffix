import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET - List corrections for user's business (paginated)
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
      return NextResponse.json({ corrections: [], total: 0 });
    }

    const businessId = user.businesses[0].id;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const [corrections, total] = await Promise.all([
      prisma.botCorrection.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.botCorrection.count({ where: { businessId } }),
    ]);

    return NextResponse.json({ corrections, total });
  } catch (error) {
    console.error("Corrections fetch error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST - Create new correction
export async function POST(request: NextRequest) {
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

    const { originalQuestion, wrongAnswer, correctAnswer, scope } = await request.json();

    if (!originalQuestion || !wrongAnswer || !correctAnswer) {
      return NextResponse.json(
        { error: "originalQuestion, wrongAnswer и correctAnswer обязательны" },
        { status: 400 }
      );
    }

    // Extract keywords from original question (filter words shorter than 3 chars)
    const keywords = originalQuestion
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((word: string) => word.length >= 3);

    const correction = await prisma.botCorrection.create({
      data: {
        originalQuestion,
        wrongAnswer,
        correctAnswer,
        scope: scope || "global",
        keywords,
        businessId: user.businesses[0].id,
      },
    });

    return NextResponse.json({ correction });
  } catch (error) {
    console.error("Correction create error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// PATCH - Update correction
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

    const { id, correctAnswer, isActive } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    // Verify correction belongs to user's business
    const existing = await prisma.botCorrection.findFirst({
      where: { id, businessId: user.businesses[0].id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Коррекция не найдена" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (correctAnswer !== undefined) updateData.correctAnswer = correctAnswer;
    if (isActive !== undefined) updateData.isActive = isActive;

    const correction = await prisma.botCorrection.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ correction });
  } catch (error) {
    console.error("Correction update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE - Delete correction
export async function DELETE(request: NextRequest) {
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

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    // Verify correction belongs to user's business
    const existing = await prisma.botCorrection.findFirst({
      where: { id, businessId: user.businesses[0].id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Коррекция не найдена" }, { status: 404 });
    }

    await prisma.botCorrection.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Correction delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
