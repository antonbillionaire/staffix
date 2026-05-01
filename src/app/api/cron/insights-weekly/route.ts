/**
 * Cron Job: Weekly AI Insights — анализ переписок и предложения для владельцев
 *
 * Запускается раз в неделю по понедельникам в 9:00 UTC (~12:00 Ташкент / ~13:00 Алматы).
 *
 * Для каждого бизнеса с активной перепиской за неделю:
 * 1) Прогоняет переписки через генератор инсайтов (insights-generator.ts)
 * 2) Создаёт AiInsight записи (faq_suggestion и т.п.)
 * 3) Если созданы новые инсайты — пушит уведомление владельцу (TG + dashboard)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInsightsForBusiness } from "@/lib/insights-generator";

const ANALYSIS_WINDOW_DAYS = 7;

async function notifyOwnerAboutInsights(
  businessId: string,
  newCount: number
): Promise<void> {
  if (newCount <= 0) return;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      botToken: true,
      ownerTelegramChatId: true,
    },
  });
  if (!business) return;

  const tag = `[insights-notify][${businessId}]`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io";

  // 1) Запись в дашборд (с бейджем)
  try {
    await prisma.notification.create({
      data: {
        businessId,
        type: "ai_insights",
        title:
          newCount === 1
            ? "💡 1 новая подсказка от AI"
            : `💡 ${newCount} новых подсказок от AI`,
        message: `AI проанализировал переписки за неделю и нашёл что можно улучшить в базе знаний. Откройте раздел "AI инсайты" в дашборде.`,
        metadata: { count: newCount },
      },
    });
    console.log(`${tag} dashboard notification CREATED count=${newCount}`);
  } catch (e) {
    console.error(`${tag} dashboard notification FAILED:`, e);
  }

  // 2) Telegram владельцу (если настроен)
  if (business.botToken && business.ownerTelegramChatId) {
    try {
      const text =
        `💡 AI-сотрудник ${business.name}: новые подсказки\n\n` +
        `За эту неделю я заметил ${newCount} ${newCount === 1 ? "вопрос" : "паттерн(ов)"}, на которые я не смог ответить — нужно ваше внимание.\n\n` +
        `Откройте в дашборде:\n${appUrl}/dashboard/insights`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${business.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: business.ownerTelegramChatId.toString(),
            text,
          }),
        }
      );
      if (!tgRes.ok) {
        const body = await tgRes.text().catch(() => "");
        console.error(`${tag} TG ${tgRes.status}: ${body.slice(0, 200)}`);
      } else {
        console.log(`${tag} TG delivered`);
      }
    } catch (e) {
      console.error(`${tag} TG fetch error:`, e);
    }
  } else {
    console.log(`${tag} TG skip: no ownerTelegramChatId`);
  }
}

async function runWeeklyInsights() {
  const since = new Date(Date.now() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        { conversations: { some: { updatedAt: { gte: since } } } },
        { channelConversations: { some: { updatedAt: { gte: since } } } },
      ],
    },
    select: { id: true, name: true },
  });

  console.log(`[insights-cron] processing ${businesses.length} businesses`);

  const results = {
    businessesProcessed: 0,
    totalCreated: 0,
    errors: [] as string[],
  };

  for (const b of businesses) {
    try {
      const { created } = await generateInsightsForBusiness(b.id);
      results.businessesProcessed++;
      results.totalCreated += created;
      if (created > 0) {
        await notifyOwnerAboutInsights(b.id, created);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[insights-cron] ${b.id} (${b.name}) failed: ${msg}`);
      results.errors.push(`${b.id}: ${msg}`);
    }
  }

  console.log(
    `[insights-cron] DONE processed=${results.businessesProcessed} created=${results.totalCreated} errors=${results.errors.length}`
  );

  return results;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runWeeklyInsights();
    return NextResponse.json(results);
  } catch (error) {
    console.error("[insights-cron] fatal:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Тот же handler для GET — позволяет ручной запуск через Vercel Cron Jobs UI
export const GET = POST;
