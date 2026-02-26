/**
 * GET /api/auth/meta — Initiate Facebook Login OAuth flow.
 * Redirects user to Facebook Login dialog.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildMetaOAuthUrl } from "@/lib/meta-oauth";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://staffix.io";

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/channels?meta_error=${encodeURIComponent("Meta App not configured")}`
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login?redirect=/dashboard/channels`);
  }

  const business = await prisma.business.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!business) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/channels?meta_error=${encodeURIComponent("Create a business first")}`
    );
  }

  const oauthUrl = buildMetaOAuthUrl(business.id);
  return NextResponse.redirect(oauthUrl);
}
