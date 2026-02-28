/**
 * GET /api/auth/meta/pages?businessId=XXX
 * Returns Facebook Pages the user manages (for page selection UI).
 * Tokens are read server-side and never exposed to the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserPages } from "@/lib/meta-oauth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
    select: { metaUserAccessToken: true },
  });

  if (!business?.metaUserAccessToken) {
    return NextResponse.json(
      { error: "No Meta token found. Please reconnect." },
      { status: 404 }
    );
  }

  try {
    const pages = await getUserPages(business.metaUserAccessToken);

    // Return only safe fields — no tokens
    const safePages = pages.map((p) => ({
      id: p.id,
      name: p.name,
      instagramAccount: p.instagram_business_account
        ? {
            id: p.instagram_business_account.id,
            username: p.instagram_business_account.username || null,
          }
        : null,
    }));

    return NextResponse.json({ pages: safePages });
  } catch (err) {
    console.error("GET /api/auth/meta/pages error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch pages" },
      { status: 500 }
    );
  }
}
