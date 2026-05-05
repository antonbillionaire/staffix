import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markBusinessConversationsForRefresh } from "@/lib/knowledge-refresh";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

// PUT - Update FAQ
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
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

    // Verify FAQ belongs to user's business
    const existingFaq = await prisma.fAQ.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingFaq) {
      return NextResponse.json({ error: "FAQ не найден" }, { status: 404 });
    }

    const faq = await prisma.fAQ.update({
      where: { id },
      data: { question, answer },
    });

    await markBusinessConversationsForRefresh(businessId);

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
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    // Verify FAQ belongs to user's business
    const existingFaq = await prisma.fAQ.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingFaq) {
      return NextResponse.json({ error: "FAQ не найден" }, { status: 404 });
    }

    await prisma.fAQ.delete({
      where: { id },
    });

    await markBusinessConversationsForRefresh(businessId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FAQ delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
