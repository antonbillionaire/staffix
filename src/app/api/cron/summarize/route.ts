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

// Максимум обработок за один запуск (чтобы не превысить timeout)
const MAX_CONVERSATIONS = 10;
const MAX_CLIENTS = 5;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = {
      conversationsSummarized: 0,
      clientsUpdated: 0,
      customFieldsFilled: 0,
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

// POST тоже поддерживаем (для Vercel Cron)
export async function POST(request: Request) {
  return GET(request);
}
