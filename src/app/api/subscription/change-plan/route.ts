import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  PLANS,
  type PlanId,
  calculateProRataCredit,
  getPlan,
} from "@/lib/plans";
import { buildCheckoutUrl, getProductId, cancelSubscription } from "@/lib/paypro";

// POST /api/subscription/change-plan
//
// Body: { planId: PlanId, billingPeriod: "monthly" | "yearly", useCredit?: boolean }
//
// Two execution paths:
//
// 1. useCredit=true AND newPrice <= currentPrice (downgrade):
//    Switch the plan immediately, terminate the old PayPro subscription so
//    no further charges, and extend expiresAt by `creditDays` worth of the
//    new (cheaper) plan. After expiresAt the user must re-subscribe to
//    keep service — the trade-off for not paying anything now.
//
// 2. Otherwise (upgrade, or downgrade where the user prefers to keep
//    auto-renew running):
//    Return a checkout URL for the new plan. The unused credit from the
//    current period rides along as `x-creditDays` and the webhook adds
//    those days to the new expiresAt on top of the regular new period.
//    The webhook also terminates the old PayPro subscription when it sees
//    a new payproSubscriptionId arrive.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planId = body.planId as PlanId | undefined;
    const billingPeriod = body.billingPeriod as "monthly" | "yearly" | undefined;
    const useCredit = body.useCredit === true;

    const validPlans: PlanId[] = ["starter", "pro", "business", "enterprise"];
    if (!planId || !validPlans.includes(planId)) {
      return NextResponse.json({ error: "Недопустимый тарифный план" }, { status: 400 });
    }
    if (!billingPeriod || !["monthly", "yearly"].includes(billingPeriod)) {
      return NextResponse.json({ error: "Недопустимый период оплаты" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      include: { subscription: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Сначала создайте бизнес" }, { status: 400 });
    }

    const sub = business.subscription;
    const targetPlan = PLANS[planId];

    // No subscription yet — just normal checkout.
    if (!sub || sub.plan === "trial" || !sub.payproSubscriptionId) {
      const productId = getProductId(planId, billingPeriod);
      if (!productId) {
        return NextResponse.json(
          { error: "Оплата временно недоступна. Свяжитесь с поддержкой." },
          { status: 503 }
        );
      }
      const checkoutUrl = buildCheckoutUrl({
        productId,
        email: session.user.email,
        firstName: session.user.name || undefined,
        userId: session.user.id,
        planId,
        billingPeriod,
        language: business.language || "ru",
        currency: "USD",
      });
      return NextResponse.json({ checkoutUrl, mode: "checkout" });
    }

    // Reject same-plan-same-period — no-op.
    if (sub.plan === planId && sub.billingPeriod === billingPeriod) {
      return NextResponse.json(
        { error: "Этот тариф уже активен" },
        { status: 400 }
      );
    }

    const currentPlan = getPlan(sub.plan);
    const currentPeriod: "monthly" | "yearly" = sub.billingPeriod === "yearly" ? "yearly" : "monthly";
    const currentPrice = currentPeriod === "yearly" ? currentPlan.yearlyPrice : currentPlan.monthlyPrice;
    const targetPrice = billingPeriod === "yearly" ? targetPlan.yearlyPrice : targetPlan.monthlyPrice;
    const isUpgrade = targetPrice > currentPrice;

    const credit = calculateProRataCredit({
      currentPlanId: sub.plan,
      currentBillingPeriod: currentPeriod,
      expiresAt: sub.expiresAt,
      targetPlanId: planId,
      targetBillingPeriod: billingPeriod,
    });

    // Path 1 — downgrade with credit (no charge).
    if (useCredit && !isUpgrade) {
      // Terminate old PayPro subscription so user is not charged again at
      // old rate when current period ends.
      const cancelResult = await cancelSubscription(sub.payproSubscriptionId);
      if (!cancelResult.success) {
        return NextResponse.json(
          { error: "Не удалось отменить предыдущую подписку у PayPro. Попробуйте позже." },
          { status: 502 }
        );
      }

      // Apply downgrade now: switch plan + extend expiresAt by credit-days at
      // the new rate. Reset reminder flags so the new (longer) cycle gets
      // fresh ones if user later cancels.
      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + credit.creditDaysAtTarget * 24 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          plan: planId,
          billingPeriod,
          messagesLimit: targetPlan.features.messagesLimit,
          messagesUsed: 0,
          expiresAt: newExpiresAt,
          status: "cancelled", // Will not auto-renew; user re-subscribes if they want continuity.
          payproSubscriptionId: null, // No more auto-renew via PayPro.
          reminder7dSent: false,
          reminder3dSent: false,
          reminder1dSent: false,
          limitWarning80Sent: false,
        },
      });

      return NextResponse.json({
        mode: "credit",
        plan: planId,
        billingPeriod,
        expiresAt: newExpiresAt.toISOString(),
        creditDaysApplied: credit.creditDaysAtTarget,
        message:
          "Тариф изменён. Кредит за оставшееся время прежнего тарифа конвертирован в дополнительные дни. " +
          "Чтобы сохранить сервис после окончания периода — оформите подписку повторно.",
      });
    }

    // Path 2 — checkout flow (upgrade, or downgrade-with-renewal).
    const productId = getProductId(planId, billingPeriod);
    if (!productId) {
      return NextResponse.json(
        { error: "Оплата временно недоступна. Свяжитесь с поддержкой." },
        { status: 503 }
      );
    }

    const checkoutUrl = buildCheckoutUrl({
      productId,
      email: session.user.email,
      firstName: session.user.name || undefined,
      userId: session.user.id,
      planId,
      billingPeriod,
      language: business.language || "ru",
      currency: "USD",
      creditDays: credit.creditDaysAtTarget,
    });

    return NextResponse.json({
      checkoutUrl,
      mode: "checkout",
      isUpgrade,
      credit: {
        daysRemaining: credit.daysRemaining,
        creditDollars: credit.creditDollars,
        creditDaysAtTarget: credit.creditDaysAtTarget,
      },
    });
  } catch (error) {
    console.error("Change-plan error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// GET — preview pro-rata for a target plan, no side effects.
// Useful for the UI to show "you'll get N extra days" before confirming.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const url = new URL(request.url);
    const planId = url.searchParams.get("planId") as PlanId | null;
    const billingPeriod = url.searchParams.get("billingPeriod") as "monthly" | "yearly" | null;

    const validPlans: PlanId[] = ["starter", "pro", "business", "enterprise"];
    if (!planId || !validPlans.includes(planId)) {
      return NextResponse.json({ error: "Недопустимый тарифный план" }, { status: 400 });
    }
    if (!billingPeriod || !["monthly", "yearly"].includes(billingPeriod)) {
      return NextResponse.json({ error: "Недопустимый период оплаты" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      include: { subscription: true },
    });
    const sub = business?.subscription;

    if (!sub || sub.plan === "trial" || !sub.payproSubscriptionId) {
      return NextResponse.json({
        canChange: true,
        hasCredit: false,
        credit: { daysRemaining: 0, creditDollars: 0, creditDaysAtTarget: 0 },
      });
    }

    const currentPlan = getPlan(sub.plan);
    const targetPlan = PLANS[planId];
    const currentPeriod: "monthly" | "yearly" = sub.billingPeriod === "yearly" ? "yearly" : "monthly";
    const currentPrice = currentPeriod === "yearly" ? currentPlan.yearlyPrice : currentPlan.monthlyPrice;
    const targetPrice = billingPeriod === "yearly" ? targetPlan.yearlyPrice : targetPlan.monthlyPrice;
    const isUpgrade = targetPrice > currentPrice;

    const credit = calculateProRataCredit({
      currentPlanId: sub.plan,
      currentBillingPeriod: currentPeriod,
      expiresAt: sub.expiresAt,
      targetPlanId: planId,
      targetBillingPeriod: billingPeriod,
    });

    return NextResponse.json({
      canChange: true,
      hasCredit: true,
      isUpgrade,
      currentPlan: sub.plan,
      currentBillingPeriod: currentPeriod,
      targetPlan: planId,
      targetBillingPeriod: billingPeriod,
      credit,
    });
  } catch (error) {
    console.error("Change-plan preview error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
