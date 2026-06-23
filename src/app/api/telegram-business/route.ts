/**
 * Telegram Business connection status & owner pause toggle.
 *
 * GET  /api/telegram-business — status for the current user's business
 * POST /api/telegram-business — { paused: boolean } toggles pausedByOwner
 *
 * Why a separate endpoint (vs reusing /api/channels): the TG Business
 * connection isn't a "channel" in our sense — it doesn't have its own bot
 * token or webhook URL, it piggybacks on the main bot. So data shape is
 * different and routing it through the channels API would add ifs everywhere.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getOwnersBusinessId(userId: string): Promise<string | null> {
  const business = await prisma.business.findFirst({
    where: { userId },
    select: { id: true },
  });
  return business?.id ?? null;
}

/**
 * Перерегистрирует webhook бота с расширенным allowed_updates. Нужно для
 * существующих ботов, зарегистрированных до того как мы добавили поддержку
 * Telegram Business — у них в Telegram стоит allowed_updates без business_*,
 * и TG не пришлёт нам business_connection даже если владелец подключит бота.
 * Идемпотентно: вызвать дважды не вредно.
 */
async function reregisterWebhook(businessId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { botToken: true, webhookSecret: true },
  });
  if (!business?.botToken || !business?.webhookSecret) return false;

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io"}/api/telegram/webhook?businessId=${businessId}`;
  const response = await fetch(
    `https://api.telegram.org/bot${business.botToken}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: [
          "message",
          "callback_query",
          "business_connection",
          "business_message",
          "edited_business_message",
          "deleted_business_messages",
        ],
        secret_token: business.webhookSecret,
      }),
    }
  );
  const data = await response.json().catch(() => null);
  return !!data?.ok;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = await getOwnersBusinessId(session.user.id);
  if (!businessId) {
    return NextResponse.json({ connected: false });
  }

  const conn = await prisma.telegramBusinessConnection.findUnique({
    where: { businessId },
    select: {
      connectionId: true,
      canReply: true,
      isEnabled: true,
      pausedByOwner: true,
      connectedAt: true,
      lastEventAt: true,
    },
  });

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    connectionId: conn.connectionId,
    canReply: conn.canReply,
    isEnabled: conn.isEnabled,
    pausedByOwner: conn.pausedByOwner,
    connectedAt: conn.connectedAt,
    lastEventAt: conn.lastEventAt,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    paused?: boolean;
    action?: "enable";
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const businessId = await getOwnersBusinessId(session.user.id);
  if (!businessId) {
    return NextResponse.json({ error: "No business" }, { status: 404 });
  }

  // action: "enable" — однократная перерегистрация webhook'а под новые
  // allowed_updates. Безопасно вызывать многократно (Telegram идемпотентен).
  if (body.action === "enable") {
    const ok = await reregisterWebhook(businessId);
    if (!ok) {
      return NextResponse.json({ error: "Не удалось обновить webhook бота" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "enable" });
  }

  // paused toggle (требует уже существующего подключения)
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "Bad body: { paused: boolean } required" }, { status: 400 });
  }
  const updated = await prisma.telegramBusinessConnection.update({
    where: { businessId },
    data: { pausedByOwner: body.paused },
    select: { pausedByOwner: true },
  }).catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "No connection yet — connect bot in Telegram Business first" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, pausedByOwner: updated.pausedByOwner });
}
