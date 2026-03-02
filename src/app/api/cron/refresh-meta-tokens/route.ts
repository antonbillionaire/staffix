/**
 * Cron job: Refresh Meta tokens expiring within 7 days.
 * Runs daily. Long-lived tokens last 60 days — refreshing early prevents downtime.
 * Also: cleans up old webhook dedup entries and sends failure alerts.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshLongLivedToken, getUserPages } from "@/lib/meta-oauth";
import { cleanupWebhookDedup } from "@/lib/webhook-dedup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends Authorization header)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Find businesses with Meta tokens expiring within 7 days
  const businesses = await prisma.business.findMany({
    where: {
      metaUserAccessToken: { not: null },
      metaTokenExpiresAt: { lt: sevenDaysFromNow },
    },
    select: {
      id: true,
      metaUserAccessToken: true,
      fbPageId: true,
    },
  });

  let refreshed = 0;
  let failed = 0;

  for (const biz of businesses) {
    if (!biz.metaUserAccessToken) continue;

    const result = await refreshLongLivedToken(biz.metaUserAccessToken);
    if (!result) {
      failed++;
      console.error(`Meta token refresh failed for business ${biz.id}`);
      continue;
    }

    // New user token → get fresh page token
    const updateData: Record<string, unknown> = {
      metaUserAccessToken: result.accessToken,
      metaTokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
    };

    // Also refresh page access token (derived from user token)
    if (biz.fbPageId) {
      try {
        const pages = await getUserPages(result.accessToken);
        const page = pages.find((p) => p.id === biz.fbPageId);
        if (page) {
          updateData.fbPageAccessToken = page.access_token;
          // Also refresh Instagram data if IG account is linked
          if (page.instagram_business_account) {
            updateData.igBusinessAccountId = page.instagram_business_account.id;
            if (page.instagram_business_account.username) {
              updateData.igUsername = page.instagram_business_account.username;
            }
          }
        }
      } catch (e) {
        console.error(`Page token refresh failed for business ${biz.id}:`, e);
      }
    }

    await prisma.business.update({
      where: { id: biz.id },
      data: updateData,
    });

    refreshed++;
  }

  console.log(`Meta token refresh: ${refreshed} refreshed, ${failed} failed, ${businesses.length} total`);

  // Alert on failures via email
  if (failed > 0 && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Staffix Alerts <alerts@staffix.io>",
        to: process.env.ADMIN_EMAIL || "admin@staffix.io",
        subject: `⚠️ Meta token refresh failed: ${failed}/${businesses.length}`,
        text: `Failed to refresh ${failed} out of ${businesses.length} Meta tokens.\n\nCheck Vercel logs for details.\n\nThis is an automated alert from Staffix cron.`,
      });
    } catch (emailErr) {
      console.error("Failed to send alert email:", emailErr);
    }
  }

  // Cleanup old webhook dedup entries (older than 24h)
  let dedupCleaned = 0;
  try {
    dedupCleaned = await cleanupWebhookDedup();
    if (dedupCleaned > 0) console.log(`Webhook dedup cleanup: ${dedupCleaned} old entries removed`);
  } catch (e) {
    console.error("Webhook dedup cleanup error:", e);
  }

  return NextResponse.json({
    refreshed,
    failed,
    total: businesses.length,
    dedupCleaned,
  });
}
