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

  // decrypt() — envelope encryption; passthrough для plaintext
  const { decrypt } = await import("@/lib/crypto");
  const token = decrypt(business.botToken) || business.botToken;
  const secret = decrypt(business.webhookSecret) || business.webhookSecret;

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io"}/api/telegram/webhook?businessId=${businessId}`;
  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
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
        secret_token: secret,
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
    return NextResponse.json({ connected: false, connections: [] });
  }

  // Возвращаем ВСЕ подключения бизнеса — владелец + сотрудники.
  // Владельческое подключение отличается через staffId = null.
  const conns = await prisma.telegramBusinessConnection.findMany({
    where: { businessId },
    select: {
      id: true,
      connectionId: true,
      ownerUserId: true,
      canReply: true,
      isEnabled: true,
      pausedByOwner: true,
      connectedAt: true,
      lastEventAt: true,
      staffId: true,
      staff: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ staffId: "asc" }, { connectedAt: "asc" }], // владелец (null) первым
  });

  // Оставляем `connected` boolean для обратной совместимости с фронтом —
  // «есть хоть одно подключение» = true. UI при этом будет ходить по списку.
  const anyConnected = conns.length > 0;
  const ownerConn = conns.find((c) => c.staffId === null);

  return NextResponse.json({
    connected: anyConnected,
    // Плоские поля владельческого подключения — старый UI на них смотрит
    connectionId: ownerConn?.connectionId,
    canReply: ownerConn?.canReply,
    isEnabled: ownerConn?.isEnabled,
    pausedByOwner: ownerConn?.pausedByOwner,
    connectedAt: ownerConn?.connectedAt,
    lastEventAt: ownerConn?.lastEventAt,
    // Полный список — новый UI будет отсюда рендерить
    connections: conns.map((c) => ({
      id: c.id,
      connectionId: c.connectionId,
      ownerUserId: c.ownerUserId.toString(),
      canReply: c.canReply,
      isEnabled: c.isEnabled,
      pausedByOwner: c.pausedByOwner,
      connectedAt: c.connectedAt,
      lastEventAt: c.lastEventAt,
      role: c.staffId === null ? "owner" : "staff",
      staff: c.staff
        ? { id: c.staff.id, name: c.staff.name, role: c.staff.role }
        : null,
    })),
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
    // Опциональный id конкретного подключения (multi-owner). Если не задан —
    // применяем к владельческому подключению (staffId=null) для обратной
    // совместимости со старым UI.
    connectionRowId?: string;
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

  // paused toggle — на конкретное подключение (multi-owner) или на владельческое.
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "Bad body: { paused: boolean } required" }, { status: 400 });
  }

  // Если передали connectionRowId — паузим только это подключение (владелец
  // может выключить конкретному сотруднику). Иначе — владельческое.
  const target = body.connectionRowId
    ? await prisma.telegramBusinessConnection.findFirst({
        where: { id: body.connectionRowId, businessId },
        select: { id: true },
      })
    : await prisma.telegramBusinessConnection.findFirst({
        where: { businessId, staffId: null },
        select: { id: true },
      });

  if (!target) {
    return NextResponse.json({ error: "No connection yet — connect bot in Telegram Business first" }, { status: 404 });
  }

  const updated = await prisma.telegramBusinessConnection.update({
    where: { id: target.id },
    data: { pausedByOwner: body.paused },
    select: { pausedByOwner: true },
  });

  return NextResponse.json({ ok: true, pausedByOwner: updated.pausedByOwner });
}
