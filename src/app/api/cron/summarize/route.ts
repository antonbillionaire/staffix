/**
 * Background Job: Generate Conversation Summaries
 * Запускается периодически (Vercel Cron или вручную)
 *
 * Создаёт краткие содержания разговоров и обновляет профили клиентов
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateConversationSummary,
  updateClientSummary,
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

    // 3. Находим клиентов у которых давно не обновлялся summary
    // (обновляем если было > 5 новых сообщений с момента последнего обновления)
    const clientsNeedingUpdate = await prisma.client.findMany({
      where: {
        OR: [
          // Никогда не было summary
          { aiSummary: null, totalMessages: { gte: 5 } },
          // Summary устарел (> 10 сообщений с момента обновления)
          {
            AND: [
              { summaryUpdatedAt: { not: null } },
              { totalMessages: { gte: 10 } },
            ],
          },
        ],
      },
      select: {
        id: true,
        businessId: true,
        telegramId: true,
        totalMessages: true,
        summaryUpdatedAt: true,
      },
      take: MAX_CLIENTS,
    });

    console.log(`Found ${clientsNeedingUpdate.length} clients needing summary update`);

    // 4. Обновляем summaries клиентов
    for (const client of clientsNeedingUpdate) {
      try {
        const summary = await updateClientSummary(
          client.businessId,
          client.telegramId
        );
        if (summary) {
          results.clientsUpdated++;
          console.log(`Updated client ${client.id}: ${summary}`);
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
