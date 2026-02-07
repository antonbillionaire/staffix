import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cancelSubscription, resumeSubscription } from "@/lib/paypro";

// GET - Fetch subscription with management info
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      include: { subscription: true },
    });

    if (!business?.subscription) {
      return NextResponse.json({ subscription: null });
    }

    const sub = business.subscription;
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((sub.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return NextResponse.json({
      subscription: {
        plan: sub.plan,
        status: sub.status,
        messagesUsed: sub.messagesUsed,
        messagesLimit: sub.messagesLimit,
        daysLeft,
        expiresAt: sub.expiresAt.toISOString(),
        billingPeriod: sub.billingPeriod,
        payproSubscriptionId: sub.payproSubscriptionId,
      },
    });
  } catch (error) {
    console.error("Subscription manage GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST - Cancel or resume subscription via PayPro API
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { action } = await request.json();

    if (!["cancel", "resume"].includes(action)) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      include: { subscription: true },
    });

    if (!business?.subscription) {
      return NextResponse.json({ error: "Подписка не найдена" }, { status: 404 });
    }

    const sub = business.subscription;

    if (!sub.payproSubscriptionId) {
      return NextResponse.json(
        { error: "Управление подпиской невозможно для пробного периода" },
        { status: 400 }
      );
    }

    if (action === "cancel") {
      const result = await cancelSubscription(sub.payproSubscriptionId);
      if (!result.success) {
        return NextResponse.json(
          { error: "Ошибка отмены подписки. Попробуйте позже." },
          { status: 500 }
        );
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "cancelled" },
      });

      return NextResponse.json({
        message: "Подписка отменена. Вы можете пользоваться услугами до конца оплаченного периода.",
      });
    }

    if (action === "resume") {
      const result = await resumeSubscription(sub.payproSubscriptionId);
      if (!result.success) {
        return NextResponse.json(
          { error: "Ошибка возобновления подписки. Попробуйте позже." },
          { status: 500 }
        );
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "active" },
      });

      return NextResponse.json({
        message: "Подписка возобновлена.",
      });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("Subscription manage POST error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
