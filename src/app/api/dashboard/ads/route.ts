/**
 * Sprint 4D (M18) — API для страницы /dashboard/ads.
 *
 * Возвращает агрегаты AdCampaignInsight за период + воронку от
 * IG/FB клика до продажи в Staffix. Требует аутентификацию владельца.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth-helpers";
import { syncAdInsightsForBusiness } from "@/lib/ad-insights";

type Period = "week" | "month" | "all";

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 6);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 29);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const business = await getCurrentBusiness();
  if (!business) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const period = (request.nextUrl.searchParams.get("period") || "week") as Period;
  const periodStart = getPeriodStart(period);

  const configured = Boolean((business.fbAdAccountId || "").trim());

  const insights = await prisma.adCampaignInsight.findMany({
    where: {
      businessId: business.id,
      ...(periodStart ? { date: { gte: periodStart } } : {}),
    },
    orderBy: { date: "desc" },
  });

  // Aggregate totals for the period
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalAttrLeads = 0;
  let totalAttrClients = 0;
  let currency: string | null = null;
  for (const r of insights) {
    totalSpend += r.spend;
    totalImpressions += r.impressions;
    totalClicks += r.clicks;
    totalAttrLeads += r.attributedLeads;
    totalAttrClients += r.attributedClients;
    if (!currency && r.currency) currency = r.currency;
  }
  const totalCtr = totalImpressions > 0 ? totalClicks / totalImpressions : null;
  const avgCpl = totalAttrLeads > 0 ? totalSpend / totalAttrLeads : null;
  const avgCpa = totalAttrClients > 0 ? totalSpend / totalAttrClients : null;

  // Per-campaign aggregation (для таблицы владельцу)
  const byCampaign = new Map<
    string,
    {
      campaignId: string;
      campaignName: string | null;
      impressions: number;
      clicks: number;
      spend: number;
      attributedLeads: number;
      attributedClients: number;
    }
  >();
  for (const r of insights) {
    const existing = byCampaign.get(r.campaignId);
    if (existing) {
      existing.impressions += r.impressions;
      existing.clicks += r.clicks;
      existing.spend += r.spend;
      existing.attributedLeads += r.attributedLeads;
      existing.attributedClients += r.attributedClients;
      if (!existing.campaignName && r.campaignName) existing.campaignName = r.campaignName;
    } else {
      byCampaign.set(r.campaignId, {
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        impressions: r.impressions,
        clicks: r.clicks,
        spend: r.spend,
        attributedLeads: r.attributedLeads,
        attributedClients: r.attributedClients,
      });
    }
  }
  const campaigns = Array.from(byCampaign.values())
    .map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? c.clicks / c.impressions : null,
      cpl: c.attributedLeads > 0 ? c.spend / c.attributedLeads : null,
      cpa: c.attributedClients > 0 ? c.spend / c.attributedClients : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  // Daily series (для графика)
  const byDay = new Map<string, { spend: number; clicks: number; leads: number }>();
  for (const r of insights) {
    const key = r.date.toISOString().slice(0, 10);
    const e = byDay.get(key);
    if (e) {
      e.spend += r.spend;
      e.clicks += r.clicks;
      e.leads += r.attributedLeads;
    } else {
      byDay.set(key, {
        spend: r.spend,
        clicks: r.clicks,
        leads: r.attributedLeads,
      });
    }
  }
  const daily = Array.from(byDay.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Воронка: IG/FB клики (из insights) → лиды (Lead.channel IG/FB) → клиенты
  // (Lead.status=client того же периода). Клики — из Marketing API;
  // лиды и клиенты — из нашей БД (Lead), поэтому даже если Marketing API
  // не подключён, часть воронки владельцу видна.
  const funnelWhere = {
    businessId: business.id,
    channel: { in: ["instagram", "facebook", "messenger"] },
    ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
  };
  const [funnelLeads, funnelClients] = await Promise.all([
    prisma.lead.count({ where: funnelWhere }),
    prisma.lead.count({ where: { ...funnelWhere, status: "client" } }),
  ]);

  return NextResponse.json({
    configured,
    period,
    currency,
    totals: {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalCtr,
      attributedLeads: totalAttrLeads,
      attributedClients: totalAttrClients,
      cpl: avgCpl,
      cpa: avgCpa,
    },
    funnel: {
      clicks: totalClicks,
      leads: funnelLeads,
      clients: funnelClients,
      clickToLead: totalClicks > 0 ? funnelLeads / totalClicks : null,
      leadToClient: funnelLeads > 0 ? funnelClients / funnelLeads : null,
    },
    campaigns,
    daily,
    // Если владельцу нужно быстро посмотреть — dry-run отдельным флагом,
    // ручной refresh делаем через POST.
    lastSyncedAt: insights[0]?.updatedAt ?? null,
  });
}

/**
 * POST — ручной sync: владелец нажимает "Обновить сейчас" на странице.
 * Полезно чтобы не ждать ночной cron.
 */
export async function POST() {
  const business = await getCurrentBusiness();
  if (!business) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!business.fbAdAccountId) {
    return NextResponse.json(
      { error: "Ad Account ID не настроен" },
      { status: 400 }
    );
  }

  const result = await syncAdInsightsForBusiness(business.id, 7);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Sync failed", rowsUpserted: 0 },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, rowsUpserted: result.rowsUpserted });
}
