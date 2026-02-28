/**
 * GET /api/auth/meta/callback — Facebook Login OAuth callback.
 * Exchanges code for tokens, discovers pages/Instagram, subscribes webhooks.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  exchangeCodeForLongLivedToken,
  getUserPages,
  subscribePageWebhooks,
} from "@/lib/meta-oauth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://staffix.io";
  const channelsUrl = `${appUrl}/dashboard/channels`;

  // User denied permissions
  if (error) {
    console.warn("Meta OAuth denied:", error, errorDescription);
    return NextResponse.redirect(
      `${channelsUrl}?meta_error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${channelsUrl}?meta_error=missing_params`);
  }

  // Decode state (contains businessId)
  let businessId: string;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    businessId = decoded.businessId;
  } catch {
    return NextResponse.redirect(`${channelsUrl}?meta_error=invalid_state`);
  }

  // Verify the user owns this business
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login?redirect=/dashboard/channels`);
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
  });
  if (!business) {
    return NextResponse.redirect(`${channelsUrl}?meta_error=unauthorized`);
  }

  try {
    // 1. Exchange code for long-lived token
    const { accessToken, expiresIn } = await exchangeCodeForLongLivedToken(code);

    // 2. Get user's pages
    const pages = await getUserPages(accessToken);
    if (pages.length === 0) {
      return NextResponse.redirect(
        `${channelsUrl}?meta_error=${encodeURIComponent("No Facebook Pages found. Create a Page first.")}`
      );
    }

    // Multiple pages → redirect to selection UI
    if (pages.length > 1) {
      // Save user-level token only (fbActive stays false → business NOT "connected")
      await prisma.business.update({
        where: { id: businessId },
        data: {
          metaUserAccessToken: accessToken,
          metaTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        },
      });
      return NextResponse.redirect(
        `${appUrl}/dashboard/channels/meta/select-page?businessId=${businessId}`
      );
    }

    // Single page → auto-select
    const page = pages[0];
    const igAccount = page.instagram_business_account;

    // 3. Subscribe page to webhook events
    await subscribePageWebhooks(page.id, page.access_token, "messages,messaging_postbacks,messaging_handovers,feed");

    // 4. Save to database
    const updateData: Record<string, unknown> = {
      // Meta OAuth
      metaUserAccessToken: accessToken,
      metaTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      // Facebook Messenger
      fbPageId: page.id,
      fbPageAccessToken: page.access_token,
      fbActive: true,
    };

    // Instagram (if page has a connected IG business account)
    if (igAccount) {
      updateData.igBusinessAccountId = igAccount.id;
      updateData.igUsername = igAccount.username || null;
      updateData.igActive = true;
    }

    await prisma.business.update({
      where: { id: businessId },
      data: updateData,
    });

    // 5. Also update ChannelConnection records for dashboard display
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    // Facebook connection
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

    // Instagram connection
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

    // Redirect back with success
    const connected = igAccount ? "instagram,facebook" : "facebook";
    const igParam = igAccount?.username ? `&ig_username=${igAccount.username}` : "";
    return NextResponse.redirect(`${channelsUrl}?meta_connected=${connected}${igParam}`);
  } catch (err) {
    console.error("Meta OAuth callback error:", err);
    return NextResponse.redirect(
      `${channelsUrl}?meta_error=${encodeURIComponent(
        err instanceof Error ? err.message : "Connection failed"
      )}`
    );
  }
}
