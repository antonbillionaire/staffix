import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserBusiness(): Promise<string | null> {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) {
    const cookieStore = await cookies();
    userId = cookieStore.get("userId")?.value || null;
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

    // Если статус изменился — уведомить клиента в Telegram
    if (body.status && body.status !== order.status && order.clientTelegramId) {
      notifyClientStatusChange(businessId, order.clientTelegramId, updated).catch(() => {});
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("PATCH /api/orders/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function notifyClientStatusChange(
  businessId: string,
  clientTelegramId: bigint,
  order: { orderNumber: number; status: string; totalPrice: number }
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { botToken: true, name: true },
  });

  if (!business?.botToken) return;

  const statusMessages: Record<string, string> = {
    confirmed: "✅ Ваш заказ подтверждён! Мы начинаем обработку.",
    processing: "⚙️ Ваш заказ в обработке.",
    shipped: "🚚 Ваш заказ отправлен! Ожидайте доставку.",
    delivered: "🎉 Ваш заказ доставлен! Надеемся, всё понравилось.",
    cancelled: "❌ Ваш заказ отменён. Свяжитесь с нами если это ошибка.",
  };

  const statusText = statusMessages[order.status];
  if (!statusText) return;

  const message =
    `${statusText}\n\n` +
    `🛒 Заказ #${order.orderNumber} | ${order.totalPrice.toLocaleString("ru-RU")}\n` +
    `От: ${business.name}`;

  await fetch(`https://api.telegram.org/bot${business.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: clientTelegramId.toString(),
      text: message,
    }),
  }).catch(() => {});
}
