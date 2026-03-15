import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendWAMessage } from "@/lib/whatsapp-utils";

async function getUserBusiness(): Promise<string | null> {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) return null;

  const business = await prisma.business.findFirst({
    where: { userId },
    select: { id: true },
  });
  return business?.id || null;
}

const VALID_STATUSES = ["new", "confirmed", "processing", "shipped", "delivered", "cancelled"];

// PATCH /api/orders/[id] — обновить статус или пометить оплаченным
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getUserBusiness();
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const order = await prisma.order.findFirst({ where: { id, businessId } });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Статус должен быть: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        isPaid: body.isPaid !== undefined ? body.isPaid : undefined,
        paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : undefined,
      },
      include: { items: true },
    });

    // Notify client about status change (all channels)
    if (body.status && body.status !== order.status) {
      notifyClientOrderStatus(businessId, order, updated).catch(() => {});
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("PATCH /api/orders/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: "✅ Ваш заказ подтверждён! Мы начинаем обработку.",
  processing: "⚙️ Ваш заказ в обработке.",
  shipped: "🚚 Ваш заказ отправлен! Ожидайте доставку.",
  delivered: "🎉 Ваш заказ доставлен! Надеемся, всё понравилось.",
  cancelled: "❌ Ваш заказ отменён. Свяжитесь с нами если это ошибка.",
};

async function notifyClientOrderStatus(
  businessId: string,
  originalOrder: { clientTelegramId: bigint | null; clientChannel: string | null; clientChannelId: string | null },
  updatedOrder: { orderNumber: number; status: string; totalPrice: number }
): Promise<void> {
  const statusText = STATUS_MESSAGES[updatedOrder.status];
  if (!statusText) return;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { botToken: true, name: true, waPhoneNumberId: true, waAccessToken: true },
  });
  if (!business) return;

  const message =
    `${statusText}\n\n` +
    `🛒 Заказ #${updatedOrder.orderNumber} | ${updatedOrder.totalPrice.toLocaleString("ru-RU")}\n` +
    `От: ${business.name}`;

  const channel = originalOrder.clientChannel;

  // Telegram notification
  if ((channel === "telegram" || !channel) && originalOrder.clientTelegramId && business.botToken) {
    await fetch(`https://api.telegram.org/bot${business.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: originalOrder.clientTelegramId.toString(),
        text: message,
      }),
    }).catch(() => {});
    return;
  }

  // WhatsApp notification
  if (channel === "whatsapp" && originalOrder.clientChannelId && business.waPhoneNumberId && business.waAccessToken) {
    await sendWAMessage(
      business.waPhoneNumberId,
      business.waAccessToken,
      originalOrder.clientChannelId,
      message
    ).catch(() => {});
    return;
  }

  // Instagram / Facebook notification
  if ((channel === "instagram" || channel === "facebook") && originalOrder.clientChannelId) {
    // IG and FB use the same Graph API for sending messages
    const pageToken = await getPageAccessToken(businessId);
    if (!pageToken) return;

    await fetch(`https://graph.facebook.com/v21.0/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pageToken}`,
      },
      body: JSON.stringify({
        recipient: { id: originalOrder.clientChannelId },
        message: { text: message },
      }),
    }).catch(() => {});
  }
}

async function getPageAccessToken(businessId: string): Promise<string | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { fbPageAccessToken: true },
  });
  return business?.fbPageAccessToken || null;
}
