/**
 * Cron job: pre-warm Anthropic prompt cache for active businesses.
 *
 * Запускается каждые 30 минут (vercel.json).
 *
 * Почему 30 минут:
 *  - TTL = 1 час. Anthropic docs: «The cache is refreshed for no additional
 *    cost each time the cached content is used» — то есть каждый успешный
 *    cache_read сбрасывает таймер. Шаг 30 мин = в 2× меньше TTL, держит
 *    запас на случай задержки в Vercel cron.
 *
 * Что делает:
 *  - Находит бизнесы, у которых была активность за последние 7 дней
 *    (через ChannelConversation.updatedAt).
 *  - Для каждого подключённого канала (IG/WA/FB) делает один минимальный
 *    Claude-вызов с тем же system prompt что в продакшене.
 *  - Кэш Anthropic'а обновляется, продакшен-вызовы попадают в cache_read
 *    вместо cache_create.
 *
 * Экономика (пример Right Flight, IG, prefix ~30K tokens):
 *  - Без warmer: 3-5 cache_create/день × ~$0.18 = $0.54-0.90/день
 *  - С warmer:   48 cache_read/день × ~$0.009 = $0.43/день, cache_create→0
 *  - Net: экономия ~$0.10-0.50/день на «жирных» бизнесах с рваным трафиком.
 *
 * Что НЕ делает:
 *  - Не подогревает TG-промпты (там есть variable client tail —
 *    отдельная история, добавим в Phase 2 если будет смысл).
 *  - Не подогревает Sales-промпты (TG sales mode — тоже Phase 2).
 *  - Не различает «активный» канал и «давно молчит» — если канал
 *    подключён, считаем что он используется.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { warmChannelCache } from "@/lib/channel-ai";

export const maxDuration = 300;

const WARM_LOOKBACK_DAYS = 7;
const MAX_BUSINESSES_PER_RUN = 100; // safety cap

const SUPPORTED_CHANNELS = ["instagram", "whatsapp", "facebook"] as const;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const since = new Date(Date.now() - WARM_LOOKBACK_DAYS * 86_400 * 1000);

  // Берём бизнесы у которых:
  //  1) подписка не suspended (нет смысла греть кэш для отключённых)
  //  2) есть подключённые каналы (IG/WA/FB) с активностью за 7 дней
  const candidates = await prisma.business.findMany({
    where: {
      OR: [
        { channelConversations: { some: { updatedAt: { gte: since } } } },
        { channelClients: { some: { lastContactAt: { gte: since } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      channelConnections: {
        where: { isConnected: true, channel: { in: ["instagram", "whatsapp", "facebook"] } },
        select: { channel: true },
      },
    },
    take: MAX_BUSINESSES_PER_RUN,
  });

  const result = {
    candidates: candidates.length,
    warmed: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  };

  // Прогрев последовательный, не параллельный — нам не критична скорость
  // (cron срабатывает раз в 30 мин, есть 5 минут maxDuration), а
  // последовательный код не выжигает rate limit Anthropic'а.
  for (const biz of candidates) {
    const channels = biz.channelConnections
      .map((c) => c.channel)
      .filter((ch): ch is (typeof SUPPORTED_CHANNELS)[number] =>
        SUPPORTED_CHANNELS.includes(ch as (typeof SUPPORTED_CHANNELS)[number])
      );
    if (channels.length === 0) {
      result.skipped++;
      continue;
    }

    for (const channel of channels) {
      try {
        const usage = await warmChannelCache(biz.id, channel);
        if (usage) result.warmed++;
        else result.skipped++;
      } catch (e) {
        result.errors++;
        console.error(`[cache-warmer] failed biz=${biz.id} channel=${channel}:`, e);
      }
    }
  }

  result.durationMs = Date.now() - startedAt.getTime();
  console.log(`[cache-warmer] done in ${result.durationMs}ms:`, result);
  return NextResponse.json(result);
}
