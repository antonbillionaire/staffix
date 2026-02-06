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

export async function GET() {
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
export async function POST() {
  return GET();
}
