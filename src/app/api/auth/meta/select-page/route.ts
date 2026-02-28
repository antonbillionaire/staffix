/**
 * POST /api/auth/meta/select-page
 * Body: { businessId: string, pageId: string }
 * Completes Meta connection for the user-selected Facebook Page.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserPages, subscribePageWebhooks } from "@/lib/meta-oauth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { businessId, pageId } = body;

  if (!businessId || !pageId) {
    return NextResponse.json(
      { error: "Missing businessId or pageId" },
      { status: 400 }
    );
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
    select: { id: true, metaUserAccessToken: true, metaTokenExpiresAt: true },
  });

  if (!business?.metaUserAccessToken) {
    return NextResponse.json(
      { error: "No Meta token found. Please reconnect." },
      { status: 404 }
    );
  }

  try {
    // Re-fetch pages server-side (token never left the server)
    const pages = await getUserPages(business.metaUserAccessToken);
    const page = pages.find((p) => p.id === pageId);

    if (!page) {
      return NextResponse.json(
        { error: "Page not found. It may have been removed." },
        { status: 404 }
      );
    }

    const igAccount = page.instagram_business_account;

    // Subscribe page to webhook events
    await subscribePageWebhooks(
      page.id,
      page.access_token,
      "messages,messaging_postbacks,messaging_handovers,feed"
    );

    // Save to Business table
    const updateData: Record<string, unknown> = {
      fbPageId: page.id,
      fbPageAccessToken: page.access_token,
      fbActive: true,
    };

    if (igAccount) {
      updateData.igBusinessAccountId = igAccount.id;
      updateData.igUsername = igAccount.username || null;
      updateData.igActive = true;
    }

    await prisma.business.update({
      where: { id: businessId },
      data: updateData,
    });

    // Upsert ChannelConnection records
    const tokenExpiry =
      business.metaTokenExpiresAt ||
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    await prisma.channelConnection.upsert({
      where: { businessId_channel: { businessId, channel: "facebook" } },
      create: {
        businessId,
        channel: "facebook",
        isConnected: true,
        isVerified: true,
        metaAccessToken: page.access_token,
        metaTokenExpiresAt: tokenExpiry,
        webhookVerified: true,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
      },
      update: {
        isConnected: true,
        isVerified: true,
        metaAccessToken: page.access_token,
        metaTokenExpiresAt: tokenExpiry,
        lastActivityAt: new Date(),
      },
    });

    if (igAccount) {
      await prisma.channelConnection.upsert({
        where: { businessId_channel: { businessId, channel: "instagram" } },
        create: {
          businessId,
          channel: "instagram",
          isConnected: true,
          isVerified: true,
          instagramAccountId: igAccount.id,
          instagramUsername: igAccount.username,
          instagramPageId: page.id,
          metaAccessToken: page.access_token,
          metaTokenExpiresAt: tokenExpiry,
          webhookVerified: true,
          connectedAt: new Date(),
          lastActivityAt: new Date(),
        },
        update: {
          isConnected: true,
          isVerified: true,
          instagramAccountId: igAccount.id,
          instagramUsername: igAccount.username,
          instagramPageId: page.id,
          metaAccessToken: page.access_token,
          metaTokenExpiresAt: tokenExpiry,
          lastActivityAt: new Date(),
        },
      });
    }

    const connected = igAccount ? "instagram,facebook" : "facebook";
    const igUsername = igAccount?.username || "";

    return NextResponse.json({ success: true, connected, igUsername });
  } catch (err) {
    console.error("POST /api/auth/meta/select-page error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Connection failed" },
      { status: 500 }
    );
  }
}
