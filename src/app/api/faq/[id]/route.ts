import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// PUT - Update FAQ
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;
    const { question, answer } = await request.json();

    if (!question || !answer) {
      return NextResponse.json(
        { error: "Вопрос и ответ обязательны" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user || user.businesses.length === 0) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    // Verify FAQ belongs to user's business
    const existingFaq = await prisma.fAQ.findFirst({
      where: {
        id,
        businessId: user.businesses[0].id,
      },
    });

    if (!existingFaq) {
      return NextResponse.json({ error: "FAQ не найден" }, { status: 404 });
    }

    const faq = await prisma.fAQ.update({
      where: { id },
      data: { question, answer },
    });

    return NextResponse.json({ faq });
  } catch (error) {
    console.error("FAQ update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE - Delete FAQ
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user || user.businesses.length === 0) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    // Verify FAQ belongs to user's business
    const existingFaq = await prisma.fAQ.findFirst({
      where: {
        id,
        businessId: user.businesses[0].id,
      },
    });

    if (!existingFaq) {
      return NextResponse.json({ error: "FAQ не найден" }, { status: 404 });
    }

    await prisma.fAQ.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FAQ delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
