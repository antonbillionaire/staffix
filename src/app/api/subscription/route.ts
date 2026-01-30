import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Plan configurations
const planConfigs: Record<string, { messagesLimit: number }> = {
  "стартовый": { messagesLimit: 500 },
  "бизнес": { messagesLimit: 2000 },
  "корпоративный": { messagesLimit: 999999 }, // Unlimited
};

// GET - Fetch current subscription
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    // Find user's business
    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      include: { subscription: true },
    });

    if (!business) {
      return NextResponse.json({ subscription: null });
    }

    return NextResponse.json({ subscription: business.subscription });
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

// POST - Create or update subscription
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { plan, billing } = await request.json();

    if (!plan) {
      return NextResponse.json(
        { error: "Тарифный план обязателен" },
        { status: 400 }
      );
    }

    const planConfig = planConfigs[plan];
    if (!planConfig) {
      return NextResponse.json(
        { error: "Недопустимый тарифный план" },
        { status: 400 }
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

    // Calculate expiration date
    const expiresAt = new Date();
    if (billing === "yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Upsert subscription
    const subscription = await prisma.subscription.upsert({
      where: { businessId: business.id },
      update: {
        plan: plan,
        messagesLimit: planConfig.messagesLimit,
        messagesUsed: 0, // Reset on new subscription
        expiresAt,
      },
      create: {
        businessId: business.id,
        plan: plan,
        messagesLimit: planConfig.messagesLimit,
        messagesUsed: 0,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error("Subscription create error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
