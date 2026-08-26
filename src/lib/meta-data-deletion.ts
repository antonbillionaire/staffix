/**
 * Meta Data Deletion — общая логика для callback endpoint'а и одноразового
 * backfill-скрипта (обработка накопившегося файла из App Dashboard).
 *
 * Проблема которую решаем (18-26 августа 2026): предыдущий handler трактовал
 * `signed_request.user_id` как ID **владельца бизнеса** и чистил только
 * бизнесы с `Business.metaUserId = user_id`. Реальные запросы Меты — про
 * **конечных клиентов** (люди, писавшие в IG DM / FB Messenger в бота
 * бизнеса-клиента). Их данные в 6 таблицах: Client, ChannelClient,
 * ChannelConversation, ChannelMessage, Lead, SalesLead — по PSID (FB) и
 * IGSID (Instagram). Также надо обфусцировать PII в Order (заказ удалить
 * нельзя — финансовая история) и очистить Task.
 *
 * Второй нюанс: `signed_request.user_id` — это ASID (App-Scoped ID). В базе
 * мы храним PSID и IGSID (Page-Scoped). Прямого matcha нет — резолвим через
 * Graph API `/{ASID}/ids_for_pages` и `/{ASID}/ids_for_business`.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface ParsedSignedRequest {
  /** ASID (App-Scoped ID) юзера, отправившего запрос на удаление */
  user_id: string;
  algorithm: string;
  issued_at?: number;
  expires?: number;
}

/**
 * Валидирует HMAC-SHA256 подпись Меты и парсит payload. Возвращает null
 * при любой ошибке (некорректный формат / плохая подпись / незнакомый
 * алгоритм). Не бросает — вызывающий код возвращает 400 при null.
 *
 * Формат: `signed_request` = `<base64url_signature>.<base64url_payload>`,
 * подпись = HMAC-SHA256(payload, app_secret). См. Meta docs.
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): ParsedSignedRequest | null {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) return null;

  const sig = Buffer.from(
    encodedSig.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest();

  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(sig, expectedSig)) return null;

  let decoded: ParsedSignedRequest;
  try {
    decoded = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf-8")
    );
  } catch {
    return null;
  }

  if (decoded.algorithm?.toUpperCase() !== "HMAC-SHA256") return null;
  if (!decoded.user_id || typeof decoded.user_id !== "string") return null;
  return decoded;
}

/**
 * Строит app access token формата `<app_id>|<app_secret>` — Graph API
 * принимает его как валидный token для server-side вызовов, которые не
 * привязаны к конкретному user access token.
 */
export function buildAppAccessToken(appId: string, appSecret: string): string {
  return `${appId}|${appSecret}`;
}

interface PageScopedIdEntry {
  id: string;
  /** page или business — какой Graph endpoint вернул этот ID */
  source: "pages" | "business";
}

/**
 * Резолв ASID → массив page-scoped ID (PSID и/или IGSID) для наших страниц
 * и бизнесов. Мета возвращает только те page-scoped IDs, которые связаны
 * с нашим приложением (id_for_pages использует app access token).
 *
 * Возвращает [] если API ответил ошибкой или пусто — вызывающий код должен
 * это обработать (продолжить с пустым списком = ничего не удалится, но
 * запрос от Меты закрывается корректно с confirmation_code).
 *
 * Ошибки НЕ бросаем — Мета ожидает ответ endpoint'а всегда, даже если
 * Graph API отвалился. Логируем и возвращаем пустой массив.
 */
export async function resolveMetaAsidToPageScopedIds(
  asid: string,
  appId: string,
  appSecret: string
): Promise<PageScopedIdEntry[]> {
  const appToken = buildAppAccessToken(appId, appSecret);
  const result: PageScopedIdEntry[] = [];

  // ids_for_pages — PSID для всех Facebook Pages бизнесов клиентов Staffix
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(asid)}/ids_for_pages?access_token=${encodeURIComponent(appToken)}`;
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      for (const entry of data.data ?? []) {
        if (entry.id) result.push({ id: entry.id, source: "pages" });
      }
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[Meta Data Deletion] ids_for_pages returned ${res.status} for ASID ${asid}: ${errText.slice(0, 200)}`
      );
    }
  } catch (e) {
    console.warn(`[Meta Data Deletion] ids_for_pages fetch failed for ASID ${asid}:`, e);
  }

  // ids_for_business — PSID/IGSID для Instagram Business Accounts,
  // подключённых через Meta Business Manager. Обязательно для случая
  // подключений через Embedded Signup / Meta Business (наш случай).
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(asid)}/ids_for_business?access_token=${encodeURIComponent(appToken)}`;
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      for (const entry of data.data ?? []) {
        if (entry.id && !result.some((r) => r.id === entry.id)) {
          result.push({ id: entry.id, source: "business" });
        }
      }
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[Meta Data Deletion] ids_for_business returned ${res.status} for ASID ${asid}: ${errText.slice(0, 200)}`
      );
    }
  } catch (e) {
    console.warn(`[Meta Data Deletion] ids_for_business fetch failed for ASID ${asid}:`, e);
  }

  return result;
}

export interface DeletionStats {
  clients: number;
  channelClients: number;
  channelConversations: number;
  channelMessages: number;
  leads: number;
  salesLeads: number;
  tasksCleared: number;
  ordersObfuscated: number;
}

const EMPTY_STATS: DeletionStats = {
  clients: 0,
  channelClients: 0,
  channelConversations: 0,
  channelMessages: 0,
  leads: 0,
  salesLeads: 0,
  tasksCleared: 0,
  ordersObfuscated: 0,
};

const META_CHANNELS = ["facebook", "instagram", "messenger"] as const;

/**
 * Удаляет данные end-user'а по массиву page-scoped IDs (PSID/IGSID).
 * Один и тот же ID может быть и в `instagramId`, и в `fbPsid` разных таблиц —
 * идём по OR-фильтру.
 *
 * Что делаем:
 *  - `Client`, `ChannelClient`, `SalesLead` — DELETE (полностью, каскадно
 *    подтянет связанные `LoyaltyLedger`, `ChannelMessage`, `Lead` через FK)
 *  - `ChannelConversation`, `ChannelMessage`, `Lead` (без клиента) —
 *    DELETE по channel+clientId/chatId (историческая ветка когда `clientId`
 *    в этих таблицах = сам PSID, а не FK на ChannelClient)
 *  - `Task` — обнуляем `clientChannel`+`clientChannelId` (задача остаётся
 *    как рабочий артефакт бизнеса, но PII удаляется)
 *  - `Order` — обфусцируем клиентские поля (заказ не удаляем — финансовая
 *    отчётность), но снимаем всю PII: имя, телефон, адрес, notes
 *
 * Возвращает статистику по каждой таблице для аудита/логов.
 */
export async function deleteEndUserMetaData(
  pageScopedIds: string[]
): Promise<DeletionStats> {
  if (pageScopedIds.length === 0) return { ...EMPTY_STATS };

  const stats = { ...EMPTY_STATS };

  // Собираем ID удаляемых Client, чтобы очистить BusinessActivityLog по ним
  const clientsToDelete = await prisma.client.findMany({
    where: {
      OR: [
        { instagramId: { in: pageScopedIds } },
        { fbPsid: { in: pageScopedIds } },
      ],
    },
    select: { id: true },
  });
  const clientIds = clientsToDelete.map((c) => c.id);

  const clientDel = await prisma.client.deleteMany({
    where: {
      OR: [
        { instagramId: { in: pageScopedIds } },
        { fbPsid: { in: pageScopedIds } },
      ],
    },
  });
  stats.clients = clientDel.count;

  const channelClientDel = await prisma.channelClient.deleteMany({
    where: {
      OR: [
        { instagramId: { in: pageScopedIds } },
        { fbPsid: { in: pageScopedIds } },
      ],
    },
  });
  stats.channelClients = channelClientDel.count;

  const convDel = await prisma.channelConversation.deleteMany({
    where: {
      channel: { in: META_CHANNELS as unknown as string[] },
      clientId: { in: pageScopedIds },
    },
  });
  stats.channelConversations = convDel.count;

  const msgDel = await prisma.channelMessage.deleteMany({
    where: {
      channel: { in: META_CHANNELS as unknown as string[] },
      chatId: { in: pageScopedIds },
    },
  });
  stats.channelMessages = msgDel.count;

  // Lead: раньше могли лежать записи без FK на ChannelClient (тогда
  // channelClient.deleteMany их не подцепит каскадом). Дочистим по channel.
  const leadDel = await prisma.lead.deleteMany({
    where: {
      channel: { in: META_CHANNELS as unknown as string[] },
      clientId: null,
    },
  });
  stats.leads = leadDel.count;

  const salesDel = await prisma.salesLead.deleteMany({
    where: {
      OR: [
        { instagramId: { in: pageScopedIds } },
        { fbPsid: { in: pageScopedIds } },
      ],
    },
  });
  stats.salesLeads = salesDel.count;

  // Task: обнуляем клиентские поля если это был Meta-канал
  const taskClear = await prisma.task.updateMany({
    where: {
      clientChannel: { in: META_CHANNELS as unknown as string[] },
      clientChannelId: { in: pageScopedIds },
    },
    data: {
      clientChannel: null,
      clientChannelId: null,
    },
  });
  stats.tasksCleared = taskClear.count;

  // Order: обфусцируем PII, но заказ оставляем (нужен для бухгалтерии)
  const orderObf = await prisma.order.updateMany({
    where: {
      clientChannel: { in: META_CHANNELS as unknown as string[] },
      clientChannelId: { in: pageScopedIds },
    },
    data: {
      clientChannelId: null,
      clientName: "deleted",
      clientPhone: null,
      clientAddress: null,
      clientNotes: null,
    },
  });
  stats.ordersObfuscated = orderObf.count;

  // Догнать BusinessActivityLog для удалённых клиентов (по clientId → FK)
  if (clientIds.length > 0) {
    await prisma.businessActivityLog.deleteMany({
      where: {
        clientId: { in: clientIds },
        channel: { in: META_CHANNELS as unknown as string[] },
      },
    });
  }

  return stats;
}

/**
 * Полный сценарий обработки одного deletion request'а: резолв ASID → удаление.
 * Возвращает статистику + список page-scoped IDs, которые пробовали (для логов).
 *
 * Двойной source of truth для ID'ов:
 *  1. Graph API `ids_for_pages` + `ids_for_business` — работает если user_id
 *     в signed_request это ASID (Facebook Login users, Messenger через FB
 *     login и т.п.).
 *  2. Raw user_id как fallback — Meta для IG Messaging API часто шлёт
 *     напрямую IGSID (Instagram-scoped ID, префикс `17841...`), не ASID.
 *     Graph API отказывает на такой ID (26 августа 2026: получили
 *     `nonexisting field` для эндпоинтов `ids_for_pages`/`ids_for_business`
 *     от IGSID `17841476160054569`). Direct match по нашим колонкам
 *     `instagramId`/`fbPsid` — единственный способ его найти.
 *
 * Ложных срабатываний нет: ASID глобален, в наших `instagramId`/`fbPsid`
 * его быть не может (там только page-scoped ID'ы наших конкретных страниц).
 */
export async function processMetaDataDeletion(
  asid: string,
  appId: string,
  appSecret: string
): Promise<{ pageScopedIds: string[]; stats: DeletionStats }> {
  const resolved = await resolveMetaAsidToPageScopedIds(asid, appId, appSecret);
  // Дедуп через Set — если Graph API вернул тот же ID что raw (маловероятно
  // но возможно на границе), избегаем дубля в SQL `IN`.
  const pageScopedIds = Array.from(new Set([asid, ...resolved.map((r) => r.id)]));
  const stats = await deleteEndUserMetaData(pageScopedIds);
  return { pageScopedIds, stats };
}

/**
 * True если статистика "чистая" (ничего не удалено, ничего не изменено).
 * Мета норм с этим — «если ID нет в базе, можете игнорировать» (см. FAQ
 * в письме). Возвращаем confirmation_code как обычно.
 */
export function isDeletionStatsEmpty(stats: DeletionStats): boolean {
  return (
    stats.clients === 0 &&
    stats.channelClients === 0 &&
    stats.channelConversations === 0 &&
    stats.channelMessages === 0 &&
    stats.leads === 0 &&
    stats.salesLeads === 0 &&
    stats.tasksCleared === 0 &&
    stats.ordersObfuscated === 0
  );
}
