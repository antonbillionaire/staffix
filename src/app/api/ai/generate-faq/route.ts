import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getUserBusiness() {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) {
    const cookieStore = await cookies();
    userId = cookieStore.get("userId")?.value || null;
  }

  if (!userId) return null;

  return prisma.business.findFirst({
    where: { userId },
    select: { id: true, name: true },
  });
}

// POST /api/ai/generate-faq
// Body: { description: string }
// Returns: { faqs: [{question, answer}] }
export async function POST(request: NextRequest) {
  try {
    const business = await getUserBusiness();
    if (!business) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const description: string = body.description?.trim();

    if (!description || description.length < 10) {
      return NextResponse.json(
        { error: "Опишите ваш бизнес подробнее (минимум 10 символов)" },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      messages: [
        {
          role: "user",
          content: `Ты помогаешь настроить базу знаний для AI-бота компании "${business.name}".

Описание бизнеса:
${description}

Сгенерируй 8 часто задаваемых вопросов (FAQ) от клиентов для этого бизнеса.

Требования:
- Вопросы должны быть реальными — такими, которые клиенты задают в мессенджерах
- Ответы краткие и конкретные (2-3 предложения)
- Используй язык описания (если написано на русском — на русском)
- Охвати: цены, время работы, адрес, условия, процесс, гарантии, доставку (если актуально)

Верни ТОЛЬКО JSON-массив без пояснений и markdown:
[{"question": "...", "answer": "..."}, ...]`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Extract JSON array from response (in case AI adds extra text)
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("AI returned invalid format");
    }

    const faqs = JSON.parse(jsonMatch[0]) as { question: string; answer: string }[];

    // Basic validation
    const validFaqs = faqs
      .filter((f) => f.question?.trim() && f.answer?.trim())
      .slice(0, 10);

    return NextResponse.json({ faqs: validFaqs });
  } catch (error) {
    console.error("POST /api/ai/generate-faq:", error);
    return NextResponse.json(
      { error: "Ошибка генерации. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
