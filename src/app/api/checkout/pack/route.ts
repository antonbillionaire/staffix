import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MESSAGE_PACKS } from "@/lib/plans";
import { getPackProductId, buildPackCheckoutUrl } from "@/lib/paypro";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { packId } = await request.json();

    // Validate pack
    const pack = MESSAGE_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json(
        { error: "Недопустимый пакет сообщений" },
        { status: 400 }
      );
    }

    // Get PayPro product ID
    const productId = getPackProductId(packId);
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
    const checkoutUrl = buildPackCheckoutUrl({
      productId,
      email: session.user.email,
      firstName: session.user.name || undefined,
      userId: session.user.id,
      packId,
      language: business.language || "ru",
      currency: "USD",
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("Pack checkout error:", error);
    return NextResponse.json(
      { error: "Ошибка создания оплаты" },
      { status: 500 }
    );
  }
}
