import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PLANS, type PlanId } from "@/lib/plans";
import { getProductId, buildCheckoutUrl } from "@/lib/paypro";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { planId, billingPeriod } = await request.json();

    // Validate plan
    const validPlans: PlanId[] = ["starter", "pro", "business", "enterprise"];
    if (!validPlans.includes(planId)) {
      return NextResponse.json(
        { error: "Недопустимый тарифный план" },
        { status: 400 }
      );
    }

    if (!["monthly", "yearly"].includes(billingPeriod)) {
      return NextResponse.json(
        { error: "Недопустимый период оплаты" },
        { status: 400 }
      );
    }

    const plan = PLANS[planId as PlanId];
    if (!plan) {
      return NextResponse.json(
        { error: "План не найден" },
        { status: 400 }
      );
    }

    // Get PayPro product ID
    const productId = getProductId(planId as PlanId, billingPeriod);
    if (!productId) {
      return NextResponse.json(
        { error: "Оплата временно недоступна. Свяжитесь с поддержкой." },
        { status: 503 }
      );
    }

    // Find user's business
    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Сначала создайте бизнес" },
        { status: 400 }
      );
    }

    // Build PayPro checkout URL
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

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Ошибка создания оплаты" },
      { status: 500 }
    );
  }
}
