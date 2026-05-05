/**
 * PATCH /api/partners/payout-details — партнёр обновляет свои реквизиты выплат.
 * Аутентификация через accessToken (тот же что в URL дашборда).
 *
 * cardLast4 — только 4 цифры. Полный PAN не принимаем и не храним (PCI-DSS scope).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function PATCH(request: NextRequest) {
  try {
    // Rate limit — защита от brute-force accessToken'ов через payout-details PATCH
    // (угаданный токен → подмена реквизитов → деньги уйдут злоумышленнику).
    const rl = await rateLimit(`partner-payout-details:${getClientIp(request)}`, 30, 1);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Слишком много запросов" },
        { status: 429 }
      );
    }

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

    const cardLast4Raw = typeof body.cardLast4 === "string" ? body.cardLast4 : null;
    const cardHolder = typeof body.cardHolder === "string" ? body.cardHolder.trim() : null;
    const bankName = typeof body.bankName === "string" ? body.bankName.trim() : null;
    const payoutNotes = typeof body.payoutNotes === "string" ? body.payoutNotes.trim() : null;

    // Last4: оставляем только цифры, берём 4 (на случай если прислали полный PAN)
    let cardLast4: string | null = null;
    if (cardLast4Raw) {
      const digits = cardLast4Raw.replace(/\D/g, "");
      if (digits.length === 0) {
        cardLast4 = null;
      } else if (digits.length < 4) {
        return NextResponse.json({ error: "Минимум 4 цифры карты" }, { status: 400 });
      } else {
        cardLast4 = digits.slice(-4);
      }
    }

    if (
      (cardHolder && cardHolder.length > 100) ||
      (bankName && bankName.length > 100) ||
      (payoutNotes && payoutNotes.length > 500)
    ) {
      return NextResponse.json({ error: "Слишком длинное значение" }, { status: 400 });
    }

    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        cardLast4,
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
