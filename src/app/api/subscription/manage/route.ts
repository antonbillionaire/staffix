import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cancelUserSubscription, resumeUserSubscription, getSubscriptionDetails } from "@/lib/lemonsqueezy";

// GET - Get subscription details
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        businesses: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user || !user.businesses[0]) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    const subscription = user.businesses[0].subscription;

    if (!subscription) {
      return NextResponse.json({
        subscription: null,
      });
    }

    // Calculate days left
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(subscription.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));

    // Get detailed subscription info from Lemon Squeezy if available
    let lemonSqueezyDetails = null;
    if (subscription.lemonSqueezySubscriptionId) {
      lemonSqueezyDetails = await getSubscriptionDetails(subscription.lemonSqueezySubscriptionId);
    }

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        messagesUsed: subscription.messagesUsed,
        messagesLimit: subscription.messagesLimit,
        expiresAt: subscription.expiresAt,
        daysLeft,
        lemonSqueezySubscriptionId: subscription.lemonSqueezySubscriptionId,
        // From Lemon Squeezy
        renewsAt: lemonSqueezyDetails?.attributes?.renews_at,
        cardBrand: lemonSqueezyDetails?.attributes?.card_brand,
        cardLastFour: lemonSqueezyDetails?.attributes?.card_last_four,
      },
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { error: "Ошибка получения подписки" },
      { status: 500 }
    );
  }
}

// POST - Manage subscription (cancel, resume)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !["cancel", "resume"].includes(action)) {
      return NextResponse.json(
        { error: "Неверное действие" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        businesses: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user || !user.businesses[0]) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    const subscription = user.businesses[0].subscription;

    if (!subscription) {
      return NextResponse.json(
        { error: "Подписка не найдена" },
        { status: 404 }
      );
    }

    if (!subscription.lemonSqueezySubscriptionId) {
      return NextResponse.json(
        { error: "Подписка не связана с платёжной системой" },
        { status: 400 }
      );
    }

    if (action === "cancel") {
      // Cancel subscription
      const result = await cancelUserSubscription(subscription.lemonSqueezySubscriptionId);

      if (!result.success) {
        return NextResponse.json(
          { error: "Ошибка отмены подписки" },
          { status: 500 }
        );
      }

      // Update local status
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "cancelled" },
      });

      return NextResponse.json({
        success: true,
        message: "Подписка отменена. Вы сможете пользоваться услугами до конца оплаченного периода.",
      });
    }

    if (action === "resume") {
      // Resume subscription
      const result = await resumeUserSubscription(subscription.lemonSqueezySubscriptionId);

      if (!result.success) {
        return NextResponse.json(
          { error: "Ошибка возобновления подписки" },
          { status: 500 }
        );
      }

      // Update local status
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "active" },
      });

      return NextResponse.json({
        success: true,
        message: "Подписка возобновлена!",
      });
    }

    return NextResponse.json(
      { error: "Неверное действие" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Manage subscription error:", error);
    return NextResponse.json(
      { error: "Ошибка управления подпиской" },
      { status: 500 }
    );
  }
}
