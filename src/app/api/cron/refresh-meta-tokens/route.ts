/**
 * Cron job: Refresh Meta tokens expiring within 7 days.
 * Runs daily. Long-lived tokens last 60 days — refreshing early prevents downtime.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshLongLivedToken, getUserPages } from "@/lib/meta-oauth";

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

  return NextResponse.json({
    refreshed,
    failed,
    total: businesses.length,
  });
}
