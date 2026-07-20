/**
 * Sprint 4D (M18) — Meta Ad Insights для владельца бизнеса.
 *
 * Читает Meta Marketing API (/v20.0/act_<id>/insights) один раз в день,
 * складывает результаты в AdCampaignInsight и обновляет атрибуцию:
 * сколько лидов и клиентов пришло с рекламы в этот день (мэпим через
 * Lead.channel=instagram|facebook + createdAt для MVP; per-campaign
 * атрибуция потребует UTM/tracking и разбирается отдельно).
 *
 * Cron проходит по всем Business с непустыми fbAdAccountId и
 * metaUserAccessToken. Ошибка одного бизнеса не должна ронять остальные.
 */

import { prisma } from "@/lib/prisma";
import { safeExternalFetch } from "@/lib/safe-fetch";
import { decrypt } from "@/lib/crypto";

const META_API_VERSION = "v20.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const FETCH_TIMEOUT_MS = 30000;

interface MetaInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  date_start?: string;
  date_stop?: string;
}

interface MetaInsightsResponse {
  data?: MetaInsightRow[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; code?: number; type?: string };
}

/**
 * Меняет "act_1234" / "1234" в единый формат "act_1234" который принимает
 * Marketing API. Пустая строка → null.
 */
export function normalizeAdAccountId(input?: string | null): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  return s.startsWith("act_") ? s : `act_${s}`;
}

/**
 * Дата в формате YYYY-MM-DD в UTC.
 */
function toDateOnlyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Строит YYYY-MM-DD → UTC-midnight Date. Именно эта точка используется
 * как ключ upsert'а в AdCampaignInsight.
 */
function parseDateStartUtc(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchInsightsPage(
  adAccountId: string,
  accessToken: string,
  windowDays: number
): Promise<MetaInsightsResponse> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - windowDays);
  const until = new Date();
  const timeRange = encodeURIComponent(
    JSON.stringify({ since: toDateOnlyUtc(since), until: toDateOnlyUtc(until) })
  );
  const fields = "campaign_id,campaign_name,impressions,clicks,spend,ctr,date_start,date_stop";
  const url =
    `${META_API_BASE}/${adAccountId}/insights` +
    `?level=campaign` +
    `&time_increment=1` +
    `&time_range=${timeRange}` +
    `&fields=${fields}` +
    `&limit=200` +
    `&access_token=${encodeURIComponent(accessToken)}`;

  const resp = await safeExternalFetch(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "<no body>");
    throw new Error(`Meta Marketing API ${resp.status}: ${text.slice(0, 300)}`);
  }
  return (await resp.json()) as MetaInsightsResponse;
}

/**
 * Считает атрибуцию за день: сколько Lead-ов пришло в этом бизнесе по
 * IG/FB каналу в указанные сутки, и сколько из них уже стали клиентами.
 * Per-campaign не разбиваем (нужен UTM/URL tags) — на этапе MVP пишем
 * одну и ту же цифру во все кампании этого дня.
 */
async function computeAttributionForDay(
  businessId: string,
  day: Date
): Promise<{ leads: number; clients: number }> {
  const start = new Date(day);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const [leadsCount, clientsCount] = await Promise.all([
    prisma.lead.count({
      where: {
        businessId,
        channel: { in: ["instagram", "facebook", "messenger"] },
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.lead.count({
      where: {
        businessId,
        channel: { in: ["instagram", "facebook", "messenger"] },
        status: "client",
        createdAt: { gte: start, lt: end },
      },
    }),
  ]);
  return { leads: leadsCount, clients: clientsCount };
}

/**
 * Забирает инсайты одного бизнеса с Meta Marketing API и upsert'ит их
 * в AdCampaignInsight. Не бросает — при ошибке пишет в лог и возвращает
 * счётчик 0. windowDays — сколько дней назад грузить (по умолчанию 7).
 */
export async function syncAdInsightsForBusiness(
  businessId: string,
  windowDays = 7
): Promise<{ ok: boolean; rowsUpserted: number; error?: string }> {
  const tag = `[ad-insights][${businessId}]`;
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { fbAdAccountId: true, metaUserAccessToken: true, metaTokenExpiresAt: true },
  });
  if (!biz) return { ok: false, rowsUpserted: 0, error: "business not found" };
  const adAccountId = normalizeAdAccountId(biz.fbAdAccountId);
  if (!adAccountId) return { ok: false, rowsUpserted: 0, error: "no fbAdAccountId" };
  if (!biz.metaUserAccessToken) return { ok: false, rowsUpserted: 0, error: "no metaUserAccessToken" };
  if (biz.metaTokenExpiresAt && biz.metaTokenExpiresAt.getTime() < Date.now()) {
    return { ok: false, rowsUpserted: 0, error: "metaUserAccessToken expired" };
  }

  // decrypt() возвращает plaintext для plaintext-строк (backwards compat) и
  // расшифровывает "v1:..." envelope-токены. throws только если key потерян.
  let token: string;
  try {
    const d = decrypt(biz.metaUserAccessToken);
    if (!d) return { ok: false, rowsUpserted: 0, error: "empty token after decrypt" };
    token = d;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, rowsUpserted: 0, error: `token decrypt: ${msg}` };
  }

  let response: MetaInsightsResponse;
  try {
    response = await fetchInsightsPage(adAccountId, token, windowDays);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${tag} fetch failed:`, msg);
    return { ok: false, rowsUpserted: 0, error: msg };
  }
  if (response.error) {
    console.error(`${tag} Meta error:`, response.error);
    return { ok: false, rowsUpserted: 0, error: response.error.message || "meta error" };
  }
  const rows = response.data || [];
  console.log(`${tag} received ${rows.length} rows from Meta`);

  // Кешируем атрибуцию по дню (тот же ключ для всех кампаний одного дня)
  const attributionByDay = new Map<string, { leads: number; clients: number }>();

  let upserted = 0;
  for (const r of rows) {
    if (!r.campaign_id) continue;
    const day = parseDateStartUtc(r.date_start);
    if (!day) continue;

    const dayKey = toDateOnlyUtc(day);
    let attr = attributionByDay.get(dayKey);
    if (!attr) {
      attr = await computeAttributionForDay(businessId, day);
      attributionByDay.set(dayKey, attr);
    }

    const impressions = parseInt(r.impressions || "0", 10) || 0;
    const clicks = parseInt(r.clicks || "0", 10) || 0;
    const spend = parseFloat(r.spend || "0") || 0;
    const ctr = r.ctr ? parseFloat(r.ctr) : impressions > 0 ? clicks / impressions : null;
    const cpl = attr.leads > 0 ? spend / attr.leads : null;

    try {
      await prisma.adCampaignInsight.upsert({
        where: {
          businessId_campaignId_date: {
            businessId,
            campaignId: r.campaign_id,
            date: day,
          },
        },
        update: {
          campaignName: r.campaign_name ?? null,
          impressions,
          clicks,
          spend,
          ctr: ctr ?? null,
          cpl: cpl ?? null,
          attributedLeads: attr.leads,
          attributedClients: attr.clients,
        },
        create: {
          businessId,
          source: "meta",
          campaignId: r.campaign_id,
          campaignName: r.campaign_name ?? null,
          date: day,
          impressions,
          clicks,
          spend,
          ctr: ctr ?? null,
          cpl: cpl ?? null,
          attributedLeads: attr.leads,
          attributedClients: attr.clients,
        },
      });
      upserted++;
    } catch (e) {
      console.error(`${tag} upsert failed for campaign ${r.campaign_id} on ${dayKey}:`, e);
    }
  }

  console.log(`${tag} upserted ${upserted} rows`);
  return { ok: true, rowsUpserted: upserted };
}

/**
 * Проходит по всем бизнесам с настроенным ad account и метапустым
 * токеном. Возвращает summary для лога cron'а.
 */
export async function syncAdInsightsForAllBusinesses(
  windowDays = 7
): Promise<{ processed: number; ok: number; failed: number }> {
  const businesses = await prisma.business.findMany({
    where: {
      NOT: [{ fbAdAccountId: null }, { fbAdAccountId: "" }],
      metaUserAccessToken: { not: null },
    },
    select: { id: true, name: true },
  });

  let ok = 0;
  let failed = 0;
  for (const b of businesses) {
    try {
      const r = await syncAdInsightsForBusiness(b.id, windowDays);
      if (r.ok) ok++;
      else failed++;
    } catch (e) {
      console.error(`[ad-insights] ${b.id} threw:`, e);
      failed++;
    }
  }

  console.log(`[ad-insights] SUMMARY processed=${businesses.length} ok=${ok} failed=${failed}`);
  return { processed: businesses.length, ok, failed };
}
