/**
 * API endpoint for managing channel connections.
 * Reads channel status from Business model fields (fbActive, igActive, waActive).
 * DELETE disconnects channels and clears tokens via Meta API.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { disconnectPage } from "@/lib/meta-oauth";

// GET - Get all channel statuses for user's business
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        businesses: {
          select: {
            id: true,
            botActive: true,
            botToken: true,
            botUsername: true,
            fbPageId: true,
            fbPageAccessToken: true,
            fbActive: true,
            igBusinessAccountId: true,
            igUsername: true,
            igActive: true,
            waPhoneNumberId: true,
            waActive: true,
            metaTokenExpiresAt: true,
          },
        },
      },
    });

    if (!user || !user.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const biz = user.businesses[0];

    // Check if Meta token is expiring soon (< 7 days)
    const tokenWarning =
      biz.metaTokenExpiresAt &&
      new Date(biz.metaTokenExpiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

    const channels = [
      {
        channel: "telegram",
        isConnected: biz.botActive || false,
        isVerified: !!biz.botToken,
        details: { username: biz.botUsername },
      },
      {
        channel: "facebook",
        isConnected: biz.fbActive || false,
        isVerified: !!biz.fbPageAccessToken,
        details: { pageId: biz.fbPageId },
        tokenWarning: biz.fbActive && tokenWarning,
      },
      {
        channel: "instagram",
        isConnected: biz.igActive || false,
        isVerified: !!biz.igBusinessAccountId,
        details: { username: biz.igUsername },
        tokenWarning: biz.igActive && tokenWarning,
      },
      {
        channel: "whatsapp",
        isConnected: biz.waActive || false,
        isVerified: !!biz.waPhoneNumberId,
        details: { phoneNumberId: biz.waPhoneNumberId },
      },
    ];

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Ошибка получения каналов" },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect a channel
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    if (!channel || !["facebook", "instagram", "whatsapp"].includes(channel)) {
      return NextResponse.json(
        { error: "Неверный канал" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        businesses: {
          select: {
            id: true,
            fbPageId: true,
            fbPageAccessToken: true,
            igBusinessAccountId: true,
          },
        },
      },
    });

    if (!user || !user.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const biz = user.businesses[0];

    if (channel === "facebook" || channel === "instagram") {
      // Disconnect Meta channels — both FB and IG use the same Page token
      // Unsubscribe page webhooks via Meta API
      if (biz.fbPageId && biz.fbPageAccessToken) {
        await disconnectPage(biz.fbPageId, biz.fbPageAccessToken).catch((e) =>
          console.error("disconnectPage error:", e)
        );
      }

      // If disconnecting one Meta channel, disconnect both (they share the same token)
      await prisma.business.update({
        where: { id: biz.id },
        data: {
          fbPageId: null,
          fbPageAccessToken: null,
          fbActive: false,
          igBusinessAccountId: null,
          igUsername: null,
          igActive: false,
          metaUserAccessToken: null,
          metaTokenExpiresAt: null,
        },
      });
    } else if (channel === "whatsapp") {
      await prisma.business.update({
        where: { id: biz.id },
        data: {
          waPhoneNumberId: null,
          waAccessToken: null,
          waActive: false,
          waVerifyToken: null,
        },
      });
    }

    // Warn that FB and IG are linked (disconnecting one disconnects both)
    const warning = (channel === "facebook" || channel === "instagram")
      ? "Facebook и Instagram используют один токен. Оба канала были отключены."
      : undefined;

    return NextResponse.json({ success: true, warning, disconnectedChannels: (channel === "facebook" || channel === "instagram") ? ["facebook", "instagram"] : [channel] });
  } catch (error) {
    console.error("Error disconnecting channel:", error);
    return NextResponse.json(
      { error: "Ошибка отключения канала" },
      { status: 500 }
    );
  }
}
