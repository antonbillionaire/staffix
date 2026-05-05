/**
 * PATCH /api/partners/payout-details — партнёр обновляет свои реквизиты выплат.
 * Аутентификация через accessToken (тот же что в URL дашборда).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body.token as string | undefined;
    if (!token) {
      return NextResponse.json({ error: "Токен не указан" }, { status: 400 });
    }

    const partner = await prisma.partner.findUnique({
      where: { accessToken: token },
      select: { id: true, status: true },
    });
    if (!partner) {
      return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 });
    }
    if (partner.status !== "approved") {
      return NextResponse.json({ error: "Аккаунт не активен" }, { status: 403 });
    }

    const cardNumber = typeof body.cardNumber === "string" ? body.cardNumber.trim() : null;
    const cardHolder = typeof body.cardHolder === "string" ? body.cardHolder.trim() : null;
    const bankName = typeof body.bankName === "string" ? body.bankName.trim() : null;
    const payoutNotes = typeof body.payoutNotes === "string" ? body.payoutNotes.trim() : null;

    // Базовая защита от слишком длинных значений
    if (
      (cardNumber && cardNumber.length > 50) ||
      (cardHolder && cardHolder.length > 100) ||
      (bankName && bankName.length > 100) ||
      (payoutNotes && payoutNotes.length > 500)
    ) {
      return NextResponse.json({ error: "Слишком длинное значение" }, { status: 400 });
    }

    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        cardNumber: cardNumber || null,
        cardHolder: cardHolder || null,
        bankName: bankName || null,
        payoutNotes: payoutNotes || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/partners/payout-details:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
