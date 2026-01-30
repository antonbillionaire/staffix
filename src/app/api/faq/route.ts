import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET - Fetch all FAQs for user's business
export async function GET() {
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
      return NextResponse.json({ faqs: [] });
    }

    const faqs = await prisma.fAQ.findMany({
      where: { businessId: user.businesses[0].id },
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
        businessId: user.businesses[0].id,
      },
    });

    return NextResponse.json({ faq });
  } catch (error) {
    console.error("FAQ create error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
