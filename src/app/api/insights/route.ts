import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markBusinessConversationsForRefresh } from "@/lib/knowledge-refresh";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

// GET - List insights for user's business + counts by status
export async function GET(request: NextRequest) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      // Сохраняем старое поведение: нет бизнеса/сессии → 200 с пустым списком
      return NextResponse.json({ insights: [], counts: { new: 0, accepted: 0, dismissed: 0 } });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // new, accepted, dismissed, или пусто = все
    const type = searchParams.get("type");

    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [insights, counts] = await Promise.all([
      prisma.aiInsight.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.aiInsight.groupBy({
        by: ["status"],
        where: { businessId },
        _count: true,
      }),
    ]);

    const countsMap = counts.reduce(
      (acc, c) => ({ ...acc, [c.status]: c._count }),
      {} as Record<string, number>
    );

    return NextResponse.json({
      insights,
      counts: {
        new: countsMap.new || 0,
        accepted: countsMap.accepted || 0,
        dismissed: countsMap.dismissed || 0,
      },
    });
  } catch (error) {
    console.error("Insights fetch error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/**
 * PATCH - Меняет статус инсайта или принимает как FAQ.
 *
 * Тело запроса:
 *   { id, status: "dismissed" }                        — просто отклонить
 *   { id, status: "accepted" }                         — принять (со встроенными данными если есть)
 *   { id, status: "accepted", question, answer }       — принять и создать FAQ из заполненной владельцем формы
 */
export async function PATCH(request: NextRequest) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id, status, question, answer } = (await request.json()) as {
      id?: string;
      status?: string;
      question?: string;
      answer?: string;
    };

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

    const existing = await prisma.aiInsight.findFirst({
      where: { id, businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Инсайт не найден" }, { status: 404 });
    }

    // Простой dismiss — без побочных эффектов
    if (status === "dismissed") {
      const insight = await prisma.aiInsight.update({
        where: { id },
        data: { status: "dismissed" },
      });
      return NextResponse.json({ insight });
    }

    // accepted — для faq_suggestion создаём FAQ
    let faqId: string | null = null;
    if (existing.type === "faq_suggestion") {
      // Берём данные либо из формы (приоритет), либо из data самого инсайта
      const insightData = (existing.data as { question?: string; answer?: string } | null) || {};
      const finalQuestion = (question ?? insightData.question ?? "").trim();
      const finalAnswer = (answer ?? insightData.answer ?? "").trim();

      if (!finalQuestion || !finalAnswer) {
        return NextResponse.json(
          {
            error:
              "Чтобы принять подсказку как FAQ — заполните ответ. Вопрос можно отредактировать.",
          },
          { status: 400 }
        );
      }

      const [faq] = await prisma.$transaction([
        prisma.fAQ.create({
          data: {
            businessId,
            question: finalQuestion,
            answer: finalAnswer,
          },
        }),
        prisma.aiInsight.update({
          where: { id },
          data: { status: "accepted" },
        }),
      ]);
      faqId = faq.id;

      // Триггерим refresh контекста бота — он сразу узнает про новый FAQ
      await markBusinessConversationsForRefresh(businessId);
    } else {
      // Любой другой тип — просто меняем статус
      await prisma.aiInsight.update({
        where: { id },
        data: { status: "accepted" },
      });
    }

    return NextResponse.json({ success: true, faqId });
  } catch (error) {
    console.error("Insight update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
