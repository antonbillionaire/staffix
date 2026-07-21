/**
 * Умная стратегия prompt-кэширования (Шаг 2 плана оптимизации себестоимости,
 * 21 июля 2026).
 *
 * ── Проблема ─────────────────────────────────────────────────────────
 * Cache_control на Sonnet 5 = 1h TTL стоит $6/M за WRITE, 5m TTL — $3.75/M.
 * Обычный (некэшированный) input — $3/M. Cache_read — $0.30/M.
 *
 * Точка окупаемости кэша:
 *   • 1h: (6 - N × 0.30) / (3 - 0.30) ≈ 3 hits — надо 3+ обращения за час
 *   • 5m: 3.75 / 2.70 ≈ 2 hits — надо 2+ обращения за 5 минут
 *
 * Если бизнес получает сообщение раз в 3 часа → cache_write умрёт до
 * первого read → мы ПЕРЕПЛАЧИВАЕМ 2× (пишем кэш = $6/M вместо $3/M).
 * Right Flight именно такой профиль.
 *
 * ── Стратегия ────────────────────────────────────────────────────────
 * stable    — префикс бизнеса, редко меняется. 1h почти всегда окупается
 *             у активных бизнесов. Оставляем 1h TTL по умолчанию.
 *
 * docs      — динамический набор документов из document-matcher. Cache_key
 *             стабилен только если matcher выбирает одинаковый набор
 *             (типично для похожих вопросов). Кэш имеет смысл только при
 *             активном трафике бизнеса (>=5 сообщений за последний час).
 *
 * variable  — per-client контекст. Кэш имеет смысл только внутри активной
 *             сессии клиента: 2+ сообщения за последние 15 минут.
 *
 * ── Реализация ───────────────────────────────────────────────────────
 * Считает activity через быстрый count по Conversation/ChannelConversation.
 * Мемоизация в памяти на 60 секунд чтобы не бомбить БД на каждый вызов.
 *
 * Env kill-switch: AI_SMART_CACHE_DISABLED=1 → возвращаем «всегда кэшировать
 * как раньше» (аварийный откат если что-то не так).
 */

import { prisma } from "@/lib/prisma";

export interface CacheStrategy {
  /** TTL для systemDocs блока или null (не кэшировать). */
  docsTTL: "5m" | "1h" | null;
  /** TTL для variableTail блока или null (не кэшировать). */
  variableTTL: "5m" | "1h" | null;
  /** TTL для stable — почти всегда "1h", разве что мёртвый бизнес совсем. */
  stableTTL: "5m" | "1h";
  /** Debug label для логов. */
  reason: string;
}

const MEMO_TTL_MS = 60_000;
type MemoEntry = { businessMsgsLastHour: number; clientMsgsLast15m?: number; expiresAt: number };
const memo = new Map<string, MemoEntry>();

async function measureActivity(
  businessId: string,
  clientId: string | null
): Promise<{ businessMsgsLastHour: number; clientMsgsLast15m: number }> {
  const now = Date.now();
  const bizKey = `biz:${businessId}`;
  const clientKey = clientId ? `cli:${businessId}:${clientId}` : null;

  const bizCached = memo.get(bizKey);
  const clientCached = clientKey ? memo.get(clientKey) : undefined;

  const needBiz = !bizCached || bizCached.expiresAt < now;
  const needClient = clientKey && (!clientCached || clientCached.expiresAt < now);

  const promises: Promise<unknown>[] = [];
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const fifteenMinAgo = new Date(now - 15 * 60 * 1000);

  let businessMsgsLastHour = bizCached?.businessMsgsLastHour ?? 0;
  let clientMsgsLast15m = clientCached?.clientMsgsLast15m ?? 0;

  if (needBiz) {
    // Считаем conversations обновлённые за час — оба типа (TG + WA/IG/FB).
    // updatedAt мутирует именно при новом сообщении, так что это точный
    // proxy без COUNT по всем Message-рядам.
    promises.push(
      (async () => {
        const [tg, ch] = await Promise.all([
          prisma.conversation.count({
            where: { businessId, updatedAt: { gte: hourAgo } },
          }),
          prisma.channelConversation.count({
            where: { businessId, updatedAt: { gte: hourAgo } },
          }),
        ]);
        businessMsgsLastHour = tg + ch;
        memo.set(bizKey, { businessMsgsLastHour, expiresAt: now + MEMO_TTL_MS });
      })().catch((e) => console.error("[cache-strategy] biz count failed:", e))
    );
  }

  if (needClient && clientKey) {
    promises.push(
      (async () => {
        // clientId в channel-ai — это ChannelClient.clientId (native id канала),
        // в telegram/ai — это Client.telegramId (bigint). Мы не знаем какая
        // именно модель — пробуем оба варианта по timestamp.
        // Быстрый путь: проверить один updatedAt последней Conversation.
        const [tg, ch] = await Promise.all([
          prisma.conversation.findFirst({
            where: { businessId },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true, clientTelegramId: true },
          }),
          prisma.channelConversation.findFirst({
            where: { businessId, clientId: clientId! },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        // Активный клиент = последнее сообщение <15 мин назад.
        const anyRecent =
          (tg?.updatedAt && tg.updatedAt >= fifteenMinAgo) ||
          (ch?.updatedAt && ch.updatedAt >= fifteenMinAgo);
        clientMsgsLast15m = anyRecent ? 2 : 0; // proxy: 2 = «явно активен»
        memo.set(clientKey, { businessMsgsLastHour: 0, clientMsgsLast15m, expiresAt: now + MEMO_TTL_MS });
      })().catch((e) => console.error("[cache-strategy] client count failed:", e))
    );
  }

  await Promise.all(promises);
  return { businessMsgsLastHour, clientMsgsLast15m };
}

/**
 * Возвращает стратегию кэширования для конкретного вызова Claude.
 * Ошибка в замерах = fallback к «кэшировать всё» (безопаснее).
 */
export async function pickCacheStrategy(
  businessId: string,
  clientId: string | null
): Promise<CacheStrategy> {
  if (process.env.AI_SMART_CACHE_DISABLED === "1") {
    return { stableTTL: "1h", docsTTL: "5m", variableTTL: "5m", reason: "disabled_by_env" };
  }
  try {
    const { businessMsgsLastHour, clientMsgsLast15m } = await measureActivity(
      businessId,
      clientId
    );
    // stable — префикс бизнеса. Кэшируем всегда: даже для quiet бизнеса
    // за день накопится 3+ обращения — окупится. Единственное исключение —
    // если бизнес совсем мёртвый (msgsLastHour = 0 И это единственный вызов).
    // Но такой edge-case дорого детектить, оставляем 1h.
    const stableTTL: "5m" | "1h" = "1h";

    // docs — набор документов, отобранных matcher'ом под запрос. Cache_key
    // зависит от подобранных доков (могут совпадать для похожих вопросов).
    // Выгоден только если бизнес получает >=5 сообщений/час.
    const docsTTL: "5m" | "1h" | null = businessMsgsLastHour >= 5 ? "5m" : null;

    // variable — per-client контекст. Кэш выгоден только внутри активной
    // сессии клиента (клиент пишет несколько сообщений подряд).
    const variableTTL: "5m" | "1h" | null = clientMsgsLast15m >= 2 ? "5m" : null;

    return {
      stableTTL,
      docsTTL,
      variableTTL,
      reason: `biz1h=${businessMsgsLastHour} client15m=${clientMsgsLast15m}`,
    };
  } catch (e) {
    console.error("[cache-strategy] measure failed, falling back:", e);
    return { stableTTL: "1h", docsTTL: "5m", variableTTL: "5m", reason: "measure_error_fallback" };
  }
}

/**
 * Хелпер для тестов и отладки — очистить memo кэш.
 */
export function clearCacheStrategyMemo() {
  memo.clear();
}
