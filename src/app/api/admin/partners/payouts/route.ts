/**
 * Admin API для batch выплат партнёрам.
 *
 * GET  — список партнёров готовых к выплате (available earnings ≥ minPayoutAmount)
 *        + список уже сделанных выплат за последние 6 месяцев (для истории)
 *
 * POST — отметить выплату партнёру как произведённую:
 *        создаётся PartnerPayout, к нему привязываются все available earnings
 *        этого партнёра (или конкретно указанные), статус → "paid".
 *        Опционально: email уведомление партнёру.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { sendPartnerPayoutSentEmail } from "@/lib/email";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    // 1. Партнёры с готовыми к выплате earnings
    const partners = await prisma.partner.findMany({
      where: { status: "approved" },
      include: {
        earnings: {
          where: { status: "available", payoutId: null },
          select: {
            id: true,
            commissionAmount: true,
            paymentAmount: true,
            subscriptionPlan: true,
            createdAt: true,
            availableAt: true,
            referral: { select: { userEmail: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const readyToPayout = partners
      .map((p) => {
        const total = p.earnings.reduce((s, e) => s + e.commissionAmount, 0);
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          referralCode: p.referralCode,
          minPayoutAmount: p.minPayoutAmount,
          agreementSignedAt: p.agreementSignedAt,
          // Реквизиты — для удобства админа в момент выплаты
          cardNumber: p.cardNumber,
          cardHolder: p.cardHolder,
          bankName: p.bankName,
          payoutNotes: p.payoutNotes,
          // Сумма к выплате и список earnings
          availableAmount: total,
          earnings: p.earnings,
          earningsCount: p.earnings.length,
          // Меты для UI
          meetsThreshold: total >= p.minPayoutAmount,
          missingPayoutDetails: !p.cardNumber || !p.cardHolder,
        };
      })
      .filter((p) => p.availableAmount > 0)
      .sort((a, b) => b.availableAmount - a.availableAmount);

    // 2. История выплат за последние 6 месяцев
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentPayouts = await prisma.partnerPayout.findMany({
      where: { paidAt: { gte: sixMonthsAgo } },
      include: {
        partner: { select: { id: true, name: true, email: true, referralCode: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 100,
    });

    // 3. Сводные totals
    const totalReady = readyToPayout.reduce((s, p) => s + p.availableAmount, 0);
    const totalAboveThreshold = readyToPayout
      .filter((p) => p.meetsThreshold)
      .reduce((s, p) => s + p.availableAmount, 0);

    return NextResponse.json({
      readyToPayout,
      recentPayouts,
      totals: {
        partnersReady: readyToPayout.filter((p) => p.meetsThreshold).length,
        amountReady: totalReady,
        amountAboveThreshold: totalAboveThreshold,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/partners/payouts:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/**
 * POST — отметить выплату как произведённую.
 *
 * Body: {
 *   partnerId: string,
 *   reference?: string,
 *   notes?: string,
 *   periodLabel?: string, // например "2026-05"
 *   sendEmail?: boolean,  // default true — отправить partner notification
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const partnerId = body.partnerId as string;
    const reference = typeof body.reference === "string" ? body.reference.trim() : null;
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    const periodLabel = typeof body.periodLabel === "string" ? body.periodLabel.trim() : null;
    const sendEmail = body.sendEmail !== false; // default true

    if (!partnerId) {
      return NextResponse.json({ error: "partnerId обязателен" }, { status: 400 });
    }

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) {
      return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 });
    }
    if (partner.status !== "approved") {
      return NextResponse.json(
        { error: `Партнёр в статусе "${partner.status}" — выплата невозможна` },
        { status: 400 }
      );
    }
    if (!partner.agreementSignedAt) {
      return NextResponse.json(
        { error: "Соглашение с партнёром не подписано — нельзя выплачивать" },
        { status: 400 }
      );
    }

    // Race-free «забронировать earnings»: создаём PartnerPayout с amount=0,
    // потом updateMany WHERE status=available AND payoutId=null (атомарно
    // привязывает только те earnings которые ещё свободны), потом считаем
    // реальную сумму уже привязанных и проставляем её.
    //
    // Если два админа одновременно нажмут «Отметить выплачено» — оба создадут
    // payout, но второй получит 0 earnings (все уже привязаны к первому payout)
    // и упадёт с понятной ошибкой. Без этого было: оба читали те же earnings,
    // partner.totalPaid инкрементился дважды, pendingPayout уходил в минус.
    const payout = await prisma.$transaction(async (tx) => {
      const created = await tx.partnerPayout.create({
        data: {
          partnerId,
          amount: 0, // обновим ниже после привязки earnings
          periodLabel: periodLabel || formatPeriodNow(),
          paymentMethod: "card",
          reference,
          paidAt: new Date(),
          paidByEmail: session.user!.email!,
          notes,
          recipientCardNumber: partner.cardNumber,
          recipientCardHolder: partner.cardHolder,
          recipientBankName: partner.bankName,
        },
      });

      const claimed = await tx.partnerEarning.updateMany({
        where: { partnerId, status: "available", payoutId: null },
        data: { status: "paid", paidAt: new Date(), payoutId: created.id },
      });

      if (claimed.count === 0) {
        // Ничего не привязалось — другой админ уже забрал, или ничего не было
        throw new Error("NO_EARNINGS_AVAILABLE");
      }

      const linked = await tx.partnerEarning.findMany({
        where: { payoutId: created.id },
        select: { commissionAmount: true },
      });
      const amount = linked.reduce((s, e) => s + e.commissionAmount, 0);

      await tx.partnerPayout.update({
        where: { id: created.id },
        data: { amount },
      });

      await tx.partner.update({
        where: { id: partnerId },
        data: {
          totalPaid: { increment: amount },
          pendingPayout: { decrement: amount },
        },
      });

      return { ...created, amount, earningsCount: claimed.count };
    }).catch((e) => {
      if (e instanceof Error && e.message === "NO_EARNINGS_AVAILABLE") return null;
      throw e;
    });

    if (!payout) {
      return NextResponse.json(
        { error: "Нет earnings готовых к выплате" },
        { status: 400 }
      );
    }

    const amount = payout.amount;
    const earningsCount = payout.earningsCount;

    // Email — после успешной транзакции, не валим если упал
    if (sendEmail && partner.accessToken) {
      sendPartnerPayoutSentEmail({
        email: partner.email,
        name: partner.name,
        accessToken: partner.accessToken,
        amount,
        reference,
        paidAt: payout.paidAt,
        recipientCardNumber: partner.cardNumber,
        bankName: partner.bankName,
      }).catch((e) => console.error("Payout-sent email failed:", e));
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount: payout.amount,
        earningsCount,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/partners/payouts:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** "2026-05" — текущий месяц в YYYY-MM */
function formatPeriodNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}
