import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// DEV ONLY: Upgrade current user to business plan
// DELETE THIS FILE IN PRODUCTION!
export async function POST() {
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
    });

    if (!business) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    // Set expiration to 1 year from now
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Upsert subscription to business plan
    const subscription = await prisma.subscription.upsert({
      where: { businessId: business.id },
      update: {
        plan: "business",
        messagesLimit: 999999,
        messagesUsed: 0,
        expiresAt,
      },
      create: {
        businessId: business.id,
        plan: "business",
        messagesLimit: 999999,
        messagesUsed: 0,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Upgraded to Business plan!",
      subscription,
    });
  } catch (error) {
    console.error("Dev upgrade error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
