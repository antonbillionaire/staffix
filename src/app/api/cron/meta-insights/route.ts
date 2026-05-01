/**
 * Cron Job: Daily Meta Insights — daily digest для Staffix-админа.
 *
 * Запускается ежедневно в 7:00 UTC (~10:00 Ташкент / ~11:00 Алматы).
 *
 * 1) Прогоняет детекторы по всем бизнесам (см. meta-insights-generator.ts)
 * 2) Создаёт MetaInsight записи (status=new)
 * 3) Шлёт Антону digest в Telegram (если выставлен ADMIN_TELEGRAM_CHAT_ID
 *    и ADMIN_TELEGRAM_BOT_TOKEN — отдельный бот для админа, либо
 *    переиспользуем основной support-бота)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateMetaInsights } from "@/lib/meta-insights-generator";

const SEVERITY_LABEL: Record<string, string> = {
  critical: "🔴",
  warn: "🟡",
  info: "🟢",
};

async function sendAdminDigest(stats: {
  newCount: number;
  byType: Record<string, number>;
}) {
  const botToken = process.env.STAFFIX_SUPPORT_BOT_TOKEN || process.env.ADMIN_TELEGRAM_BOT_TOKEN;
  const chatIdEnv = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!botToken || !chatIdEnv) {
    console.log("[meta-insights-cron] no ADMIN_TELEGRAM_CHAT_ID/BOT_TOKEN — digest skipped");
    return;
  }

  // Берём все актуальные новые инсайты для сводки
  const insights = await prisma.metaInsight.findMany({
    where: { status: "new" },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  // Метрики платформы за сутки — грубая сводка
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [activeBiz, msgCount, bookingCount, orderCount] = await Promise.all([
    prisma.business.count({
      where: {
        OR: [
          { conversations: { some: { updatedAt: { gte: since } } } },
          { channelConversations: { some: { updatedAt: { gte: since } } } },
        ],
      },
    }),
    prisma.message.count({ where: { createdAt: { gte: since } } }),
    prisma.booking.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
  ]);

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [];
  lines.push(`📊 Staffix Daily — ${today}`);
  lines.push("");
  lines.push(`Активные бизнесы: ${activeBiz}`);
  lines.push(`Сообщений за сутки: ${msgCount}`);
  lines.push(`Записей создано: ${bookingCount}`);
  lines.push(`Заказов оформлено: ${orderCount}`);
  lines.push("");

  if (insights.length === 0) {
    lines.push("✅ Системных проблем не обнаружено");
  } else {
    const critical = insights.filter((i) => i.severity === "critical");
    const warn = insights.filter((i) => i.severity === "warn");
    const info = insights.filter((i) => i.severity === "info");

    lines.push(`⚠️ Требуют внимания: ${insights.length} (новых за сутки: ${stats.newCount})`);
    lines.push("");

    for (const insight of [...critical, ...warn, ...info].slice(0, 10)) {
      const icon = SEVERITY_LABEL[insight.severity] || "•";
      lines.push(`${icon} ${insight.title}`);
    }
    if (insights.length > 10) {
      lines.push(`… и ещё ${insights.length - 10}`);
    }
    lines.push("");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io";
    lines.push(`Подробности: ${appUrl}/admin/meta-insights`);
  }

  const text = lines.join("\n");

  // Поддерживаем comma-separated список chat_id для нескольких админов
  const chatIds = chatIdEnv.split(",").map((s) => s.trim()).filter(Boolean);

  for (const chatId of chatIds) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!tgRes.ok) {
        const body = await tgRes.text().catch(() => "");
        console.error(`[meta-insights-cron] TG ${tgRes.status} for ${chatId}: ${body.slice(0, 200)}`);
      } else {
        console.log(`[meta-insights-cron] digest delivered to ${chatId}`);
      }
    } catch (e) {
      console.error(`[meta-insights-cron] TG send failed for ${chatId}:`, e);
    }
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { created, byType } = await generateMetaInsights();
    await sendAdminDigest({ newCount: created, byType });
    return NextResponse.json({ created, byType });
  } catch (error) {
    console.error("[meta-insights-cron] fatal:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const GET = POST;
