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
  //  3) у бизнеса СЕЙЧАС рабочие часы (по Business.timezone)
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
      timezone: true, // для фильтра «сейчас рабочие часы?»
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
    skippedNoChannel: 0,
    skippedNight: 0,  // сколько бизнесов пропущено потому что у них ночь
    errors: 0,
    durationMs: 0,
  };

  // Локальный час бизнеса — простая проверка «сейчас рабочие часы?».
  // Работаем 8:00-22:00 по Business.timezone. Ночью греть кэш бессмысленно —
  // клиенты не пишут, а cache TTL 1 час всё равно истечёт к утру.
  // При отсутствии timezone используем Asia/Tashkent как разумный default
  // (основной рынок Staffix CIS).
  function isBusinessHoursNow(tz: string | null): boolean {
    const timezone = tz || "Asia/Tashkent";
    try {
      const hourStr = new Date().toLocaleString("en-US", {
        timeZone: timezone,
        hour12: false,
        hour: "2-digit",
      });
      const hour = parseInt(hourStr, 10);
      if (Number.isNaN(hour)) return true; // safe default — не пропускаем
      return hour >= 8 && hour < 22;
    } catch {
      return true; // при ошибке парсинга TZ — греем на всякий случай
    }
  }

  // Прогрев последовательный, не параллельный — нам не критична скорость
  // (cron срабатывает раз в 30 мин, есть 5 минут maxDuration), а
  // последовательный код не выжигает rate limit Anthropic'а.
  for (const biz of candidates) {
    // Пропускаем бизнесы у которых сейчас ночь по их локальному времени
    if (!isBusinessHoursNow(biz.timezone)) {
      result.skippedNight++;
      continue;
    }

    const channels = biz.channelConnections
      .map((c) => c.channel)
      .filter((ch): ch is (typeof SUPPORTED_CHANNELS)[number] =>
        SUPPORTED_CHANNELS.includes(ch as (typeof SUPPORTED_CHANNELS)[number])
      );
    if (channels.length === 0) {
      result.skippedNoChannel++;
      continue;
    }

    for (const channel of channels) {
      try {
        const usage = await warmChannelCache(biz.id, channel);
        if (usage) result.warmed++;
        else result.skippedNoChannel++;
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
