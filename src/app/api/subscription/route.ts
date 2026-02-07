import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

// POST is not allowed — subscriptions are activated only via PayPro webhook
// Use /api/checkout to initiate payment, /api/subscription/manage to cancel/resume
