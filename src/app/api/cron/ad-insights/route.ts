/**
 * Cron Job: Meta Ad Insights sync — Sprint 4D (M18).
 *
 * Ежедневно тянет данные Meta Marketing API по всем бизнесам с
 * fbAdAccountId и валидным metaUserAccessToken; upsert'ит записи
 * в AdCampaignInsight. Владелец видит на /dashboard/ads.
 *
 * Окно тянем 7 дней назад чтобы автозакрыть данные если один день
 * был пропущен (сеть, rate-limit Meta).
 */

import { NextResponse } from "next/server";
import { syncAdInsightsForAllBusinesses } from "@/lib/ad-insights";
import { checkCronAuth } from "@/lib/cron-auth";

export const maxDuration = 300;

const WINDOW_DAYS = 7;

export async function POST(request: Request) {
  const cronAuth = checkCronAuth(request);
  if (!cronAuth.ok) return cronAuth.response!;

  try {
    const summary = await syncAdInsightsForAllBusinesses(WINDOW_DAYS);
    return NextResponse.json({ ...summary, windowDays: WINDOW_DAYS });
  } catch (error) {
    console.error("[ad-insights-cron] fatal:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const GET = POST;
