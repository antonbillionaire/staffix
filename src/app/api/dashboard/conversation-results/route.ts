/**
 * GET /api/dashboard/conversation-results
 *
 * Результаты диалогов за период — метрика цели из research-плана (Этап 2.5):
 * сколько диалогов закончились записью, заказом или полученным контактом,
 * а сколько потеряны.
 *
 * Партнёрские диалоги (блогеры, UGC, бартер) в знаменатель не идут —
 * они не покупатели, и их присутствие делало бы метрику вечно низкой.
 * Классификация — по тексту сообщений клиента, см. conversation-kind.ts.
 *
 * Query: ?period=day|week|month (по умолчанию month)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";
import { isSuccessOutcome, isLossOutcome } from "@/lib/conversation-outcome";
import { classifyConversationKind, countsTowardFunnelMetric } from "@/lib/conversation-kind";

type Period = "day" | "week" | "month";

function periodStart(period: Period): Date {
  const d = new Date();
  const days = period === "day" ? 1 : period === "week" ? 7 : 30;
  d.setDate(d.getDate() - days);
  return d;
}

/** Достаёт тексты сообщений клиента из JSON-истории канального диалога. */
function clientTextsFromHistory(history: unknown): string[] {
  if (!Array.isArray(history)) return [];
  return (history as Array<{ role?: string; content?: string }>)
    .filter((m) => m?.role === "user" && typeof m.content === "string")
    .map((m) => m.content as string);
}

export async function GET(request: NextRequest) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const period = (request.nextUrl.searchParams.get("period") || "month") as Period;
    const since = periodStart(period);

    const [channelConvs, tgConvs] = await Promise.all([
      prisma.channelConversation.findMany({
        where: { businessId, updatedAt: { gte: since } },
        select: { channel: true, outcome: true, history: true },
      }),
      prisma.conversation.findMany({
        where: { businessId, updatedAt: { gte: since } },
        select: {
          outcome: true,
          messages: {
            where: { role: "user" },
            select: { content: true },
            take: 10,
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    ]);

    // Счётчики: total — только диалоги с покупателями (партнёрка исключена).
    let total = 0;
    let success = 0;
    let lost = 0;
    let inProgress = 0; // исход ещё не определился — диалог свежий
    let partnership = 0;
    const byChannel: Record<string, { total: number; success: number; lost: number }> = {};

    const bump = (channel: string, kind: "total" | "success" | "lost") => {
      if (!byChannel[channel]) byChannel[channel] = { total: 0, success: 0, lost: 0 };
      byChannel[channel][kind]++;
    };

    for (const c of channelConvs) {
      const conversationKind = classifyConversationKind(clientTextsFromHistory(c.history));
      if (!countsTowardFunnelMetric(conversationKind)) {
        partnership++;
        continue;
      }
      total++;
      bump(c.channel, "total");
      if (isSuccessOutcome(c.outcome)) {
        success++;
        bump(c.channel, "success");
      } else if (isLossOutcome(c.outcome)) {
        lost++;
        bump(c.channel, "lost");
      } else if (!c.outcome) {
        inProgress++;
      }
    }

    for (const c of tgConvs) {
      const conversationKind = classifyConversationKind(c.messages.map((m) => m.content));
      if (!countsTowardFunnelMetric(conversationKind)) {
        partnership++;
        continue;
      }
      total++;
      bump("telegram", "total");
      if (isSuccessOutcome(c.outcome)) {
        success++;
        bump("telegram", "success");
      } else if (isLossOutcome(c.outcome)) {
        lost++;
        bump("telegram", "lost");
      } else if (!c.outcome) {
        inProgress++;
      }
    }

    // Процент считаем от завершённых диалогов: незакрытые ещё могут стать
    // и успехом, и потерей — включать их в знаменатель значит занижать
    // результат тем сильнее, чем свежее период.
    const finished = success + lost;
    const successRate = finished > 0 ? Math.round((success / finished) * 100) : null;

    return NextResponse.json({
      period,
      total,
      success,
      lost,
      inProgress,
      partnership,
      successRate,
      byChannel,
    });
  } catch (error) {
    console.error("GET /api/dashboard/conversation-results:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
