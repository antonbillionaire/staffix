/**
 * Background Job: Generate Conversation Summaries
 * Запускается периодически (Vercel Cron или вручную)
 *
 * Создаёт краткие содержания разговоров и обновляет профили клиентов
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 300s — потолок Vercel Pro. Cron делает много sequential Claude-вызовов.
export const maxDuration = 300;
import {
  generateConversationSummary,
  updateClientSummary,
  extractCustomFieldsFromConversation,
} from "@/lib/ai-memory";
import { checkCronAuth } from "@/lib/cron-auth";
import { outcomeFromSilence } from "@/lib/conversation-outcome";

// Максимум обработок за один запуск (чтобы не превысить timeout)
const MAX_CONVERSATIONS = 10;
const MAX_CLIENTS = 5;

export async function GET(request: Request) {
  // Verify cron secret
  const cronAuth = checkCronAuth(request);
  if (!cronAuth.ok) return cronAuth.response!;

  try {
    const results = {
      conversationsSummarized: 0,
      clientsUpdated: 0,
      customFieldsFilled: 0,
      greyZoneClosed: 0,
      errors: [] as string[],
    };

    // 1. Находим разговоры которым нужен summary
    const conversationsNeedingSummary = await prisma.conversation.findMany({
      where: {
        needsSummary: true,
      },
      select: {
        id: true,
        businessId: true,
        clientTelegramId: true,
      },
      take: MAX_CONVERSATIONS,
    });

    console.log(
      `Found ${conversationsNeedingSummary.length} conversations needing summary`
    );

    // 2. Генерируем summaries для разговоров
    for (const conv of conversationsNeedingSummary) {
      try {
        const summary = await generateConversationSummary(conv.id);
        if (summary) {
          results.conversationsSummarized++;
          console.log(`Summarized conversation ${conv.id}: ${summary}`);
        }
      } catch (error) {
        results.errors.push(`Conversation ${conv.id}: ${error}`);
      }
    }

    // 3. Находим клиентов у которых нужен свежий summary.
    //
    // Ветка 1: у клиента вообще нет summary + накоплено ≥5 сообщений.
    // Ветка 2: summary устарел — было ≥10 сообщений И lastMessageAt свежее
    //          чем summaryUpdatedAt (иначе пере-суммаризируем один и тот же
    //          неизменный диалог каждые 2 часа впустую, жгём Haiku токены).
    //
    // Prisma не умеет cross-field compare в findMany — используем $queryRaw.
    // Возвращаем только id, дальше select полноценных полей отдельным запросом.
    const staleClientRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Client"
      WHERE (
        ("aiSummary" IS NULL AND "totalMessages" >= 5)
        OR
        ("summaryUpdatedAt" IS NOT NULL AND "totalMessages" >= 10
          AND "lastMessageAt" IS NOT NULL
          AND "lastMessageAt" > "summaryUpdatedAt")
      )
      ORDER BY "lastMessageAt" DESC NULLS LAST
      LIMIT ${MAX_CLIENTS}
    `;

    const clientsNeedingUpdate = staleClientRows.length
      ? await prisma.client.findMany({
          where: { id: { in: staleClientRows.map((r) => r.id) } },
          select: {
            id: true,
            businessId: true,
            telegramId: true,
            totalMessages: true,
            summaryUpdatedAt: true,
          },
        })
      : [];

    console.log(`Found ${clientsNeedingUpdate.length} clients needing summary update`);

    // 4. Обновляем summaries клиентов + извлекаем custom fields из истории.
    // Custom fields заполняются ТОЛЬКО где они не заполнены вручную и AI
    // нашёл значение в диалогах. No-op если у бизнеса нет полей в конфиге.
    for (const client of clientsNeedingUpdate) {
      try {
        // Sprint 3: telegramId стал nullable — для WA/IG/FB-only клиентов
        // summary/customFields сейчас пропускаем (channel-based summary
        // будет в Sprint 3 через единый ai/core.ts).
        if (!client.telegramId) continue;
        const summary = await updateClientSummary(
          client.businessId,
          client.telegramId
        );
        if (summary) {
          results.clientsUpdated++;
          console.log(`Updated client ${client.id}: ${summary}`);
        }
        const cfResult = await extractCustomFieldsFromConversation(
          client.businessId,
          client.telegramId
        );
        if (cfResult && cfResult.updated > 0) {
          results.customFieldsFilled += cfResult.updated;
        }
      } catch (error) {
        results.errors.push(`Client ${client.id}: ${error}`);
      }
    }

    // 5. Channel conversations (WhatsApp/Instagram/Facebook) needing summary
    try {
      const channelConvs = await prisma.channelConversation.findMany({
        where: { needsSummary: true },
        select: { id: true },
        take: MAX_CONVERSATIONS,
      });

      if (channelConvs.length > 0) {
        const { generateChannelConversationSummary, updateChannelClientSummary } = await import("@/lib/channel-memory");

        for (const conv of channelConvs) {
          try {
            await generateChannelConversationSummary(conv.id);
            results.conversationsSummarized++;
          } catch (error) {
            results.errors.push(`ChannelConv ${conv.id}: ${error}`);
          }
        }
      }

      // 6. Channel clients needing summary update
      const channelClients = await prisma.channelClient.findMany({
        where: {
          aiSummary: null,
          totalMessages: { gte: 5 },
        },
        select: { id: true },
        take: MAX_CLIENTS,
      });

      if (channelClients.length > 0) {
        const { updateChannelClientSummary } = await import("@/lib/channel-memory");

        for (const client of channelClients) {
          try {
            await updateChannelClientSummary(client.id);
            results.clientsUpdated++;
          } catch (error) {
            results.errors.push(`ChannelClient ${client.id}: ${error}`);
          }
        }
      }
    } catch (channelErr) {
      console.error("Channel summarization error:", channelErr);
      results.errors.push(`Channel: ${channelErr}`);
    }

    // 7. Серая зона: диалоги, где исход не определился фактом (Этап 2.3).
    //
    // Проверка 17 сентября 2026: 2473 диалога из 2554 короче 10 сообщений,
    // а needsSummary ставится каждое 10-е — то есть 97 % диалогов до
    // суммаризации не доходят и остаются без outcome навсегда.
    //
    // Сильные исходы (booked / ordered / lead_captured / escalated) ставятся
    // по факту вызова инструмента прямо в обороте. Здесь закрываем остальное
    // по времени и последнему говорящему — без единого вызова модели.
    try {
      results.greyZoneClosed = await closeGreyZoneOutcomes();
    } catch (greyErr) {
      console.error("Grey-zone outcome error:", greyErr);
      results.errors.push(`GreyZone: ${greyErr}`);
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Summarization cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Проставляет исход диалогам, которые «затихли» и так и не получили его
 * по факту вызова инструмента.
 *
 * Модель не вызывается: решение принимается по времени последней активности
 * и по тому, кто говорил последним. Логика — в conversation-outcome.ts.
 *
 * Порог тишины — сутки. Короче ставить опасно: клиент, написавший утром
 * и вернувшийся вечером, — не потеря.
 */
async function closeGreyZoneOutcomes(): Promise<number> {
  const ABANDON_AFTER_MINUTES = 24 * 60;
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MINUTES * 60 * 1000);
  const BATCH = 200;
  let closed = 0;

  // ─── Каналы (WA/IG/FB) ───────────────────────────────────────────────
  const channelConvs = await prisma.channelConversation.findMany({
    where: { outcome: null, updatedAt: { lt: cutoff } },
    select: { id: true, history: true, updatedAt: true },
    take: BATCH,
  });

  for (const conv of channelConvs) {
    const history = (conv.history as Array<{ role: string; content: string }>) || [];
    const last = history[history.length - 1];
    const lastRole = last?.role === "assistant" ? "assistant" : last?.role === "user" ? "user" : null;
    const minutes = (Date.now() - conv.updatedAt.getTime()) / 60000;

    const outcome = outcomeFromSilence({
      lastRole,
      minutesSinceLastMessage: minutes,
      abandonAfterMinutes: ABANDON_AFTER_MINUTES,
    });
    if (!outcome) continue;

    await prisma.channelConversation
      .update({ where: { id: conv.id }, data: { outcome } })
      .then(() => {
        closed++;
      })
      .catch(() => {});
  }

  // ─── Telegram ────────────────────────────────────────────────────────
  const tgConvs = await prisma.conversation.findMany({
    where: { outcome: null, updatedAt: { lt: cutoff } },
    select: {
      id: true,
      updatedAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { role: true } },
    },
    take: BATCH,
  });

  for (const conv of tgConvs) {
    const last = conv.messages[0];
    const lastRole = last?.role === "assistant" ? "assistant" : last?.role === "user" ? "user" : null;
    const minutes = (Date.now() - conv.updatedAt.getTime()) / 60000;

    const outcome = outcomeFromSilence({
      lastRole,
      minutesSinceLastMessage: minutes,
      abandonAfterMinutes: ABANDON_AFTER_MINUTES,
    });
    if (!outcome) continue;

    await prisma.conversation
      .update({ where: { id: conv.id }, data: { outcome } })
      .then(() => {
        closed++;
      })
      .catch(() => {});
  }

  if (closed > 0) console.log(`[summarize] grey-zone outcomes closed: ${closed}`);
  return closed;
}

// POST тоже поддерживаем (для Vercel Cron)
export async function POST(request: Request) {
  return GET(request);
}
