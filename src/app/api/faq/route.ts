import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markBusinessConversationsForRefresh } from "@/lib/knowledge-refresh";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

// GET - Fetch all FAQs for user's business
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      // Сохраняем старое поведение: нет бизнеса/сессии → 200 с пустым списком
      return NextResponse.json({ faqs: [] });
    }

    const faqs = await prisma.fAQ.findMany({
      where: { businessId },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ faqs });
  } catch (error) {
    console.error("FAQ fetch error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST - Create new FAQ
export async function POST(request: NextRequest) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { question, answer } = await request.json();

    if (!question || !answer) {
      return NextResponse.json(
        { error: "Вопрос и ответ обязательны" },
        { status: 400 }
      );
    }

    const faq = await prisma.fAQ.create({
      data: {
        question,
        answer,
        businessId,
      },
    });

    await markBusinessConversationsForRefresh(businessId);

    return NextResponse.json({ faq });
  } catch (error) {
    console.error("FAQ create error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
