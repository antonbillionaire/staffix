/**
 * Cron job: Refresh Meta tokens expiring within 7 days.
 * Runs daily. Long-lived tokens last 60 days — refreshing early prevents downtime.
 * Also: cleans up old webhook dedup entries and sends failure alerts.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshLongLivedToken, getUserPages } from "@/lib/meta-oauth";
import { cleanupWebhookDedup } from "@/lib/webhook-dedup";
import { encrypt, decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends Authorization header)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Find businesses with Meta tokens expiring within 7 days.
  // OR includes `metaTokenExpiresAt: null` — businesses migrated from an older
  // schema or entered via manual OAuth may have the timestamp missing; without
  // the null branch we would silently skip refresh and their IG/FB would die
  // ~60 days after connection.
  const businesses = await prisma.business.findMany({
    where: {
      metaUserAccessToken: { not: null },
      OR: [
        { metaTokenExpiresAt: null },
        { metaTokenExpiresAt: { lt: sevenDaysFromNow } },
      ],
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

    // decrypt() — envelope encryption; passthrough для plaintext (backwards compat)
    let currentToken: string | null;
    try {
      currentToken = decrypt(biz.metaUserAccessToken);
    } catch (e) {
      console.error(`Meta token decrypt failed for business ${biz.id}:`, e);
      failed++;
      continue;
    }
    if (!currentToken) continue;

    const result = await refreshLongLivedToken(currentToken);
    if (!result) {
      failed++;
      console.error(`Meta token refresh failed for business ${biz.id}`);
      continue;
    }

    // New user token → get fresh page token. Токены шифруются перед сохранением.
    const updateData: Record<string, unknown> = {
      metaUserAccessToken: encrypt(result.accessToken),
      metaTokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
    };

    // Also refresh page access token (derived from user token)
    if (biz.fbPageId) {
      try {
        const pages = await getUserPages(result.accessToken);
        const page = pages.find((p) => p.id === biz.fbPageId);
        if (page) {
          updateData.fbPageAccessToken = encrypt(page.access_token);
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
        // Don't save partial update — user token without page token will break webhooks
        failed++;
        continue;
      }
    }

    await prisma.business.update({
      where: { id: biz.id },
      data: updateData,
    });

    refreshed++;
  }

  console.log(`Meta token refresh: ${refreshed} refreshed, ${failed} failed, ${businesses.length} total`);

  // ─── WhatsApp Cloud API token refresh ────────────────────────────────────
  // WA tokens live ~60 days too and use the same fb_exchange_token endpoint.
  // Businesses connected before this migration have waTokenExpiresAt=null —
  // refresh them proactively so they don't silently expire.
  const waBusinesses = await prisma.business.findMany({
    where: {
      waAccessToken: { not: null },
      waActive: true,
      OR: [
        { waTokenExpiresAt: null },
        { waTokenExpiresAt: { lt: sevenDaysFromNow } },
      ],
    },
    select: {
      id: true,
      waAccessToken: true,
    },
  });

  let waRefreshed = 0;
  let waFailed = 0;

  for (const biz of waBusinesses) {
    if (!biz.waAccessToken) continue;

    let currentToken: string | null;
    try {
      currentToken = decrypt(biz.waAccessToken);
    } catch (e) {
      console.error(`WA token decrypt failed for business ${biz.id}:`, e);
      waFailed++;
      continue;
    }
    if (!currentToken) continue;

    const result = await refreshLongLivedToken(currentToken);
    if (!result) {
      waFailed++;
      console.error(`WA token refresh failed for business ${biz.id}`);
      continue;
    }

    await prisma.business.update({
      where: { id: biz.id },
      data: {
        waAccessToken: encrypt(result.accessToken),
        waTokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
      },
    });

    waRefreshed++;
  }

  console.log(`WA token refresh: ${waRefreshed} refreshed, ${waFailed} failed, ${waBusinesses.length} total`);

  const totalFailed = failed + waFailed;
  const totalCount = businesses.length + waBusinesses.length;

  // Alert on failures via email
  if (totalFailed > 0 && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Staffix Alerts <alerts@staffix.io>",
        to: process.env.ADMIN_EMAIL || "admin@staffix.io",
        subject: `⚠️ Token refresh failed: ${totalFailed}/${totalCount}`,
        text: `Meta: ${failed}/${businesses.length} failed.\nWhatsApp: ${waFailed}/${waBusinesses.length} failed.\n\nCheck Vercel logs for details.\n\nThis is an automated alert from Staffix cron.`,
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
    meta: { refreshed, failed, total: businesses.length },
    whatsapp: { refreshed: waRefreshed, failed: waFailed, total: waBusinesses.length },
    dedupCleaned,
  });
}
