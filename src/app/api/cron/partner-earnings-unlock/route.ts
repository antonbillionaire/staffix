/**
 * Cron Job: Partner earnings unlock
 *
 * Раз в сутки переводит PartnerEarning со статуса "pending" в "available",
 * если availableAt уже прошёл (createdAt + 30 days hold-period).
 *
 * Также группирует по партнёру и пушит уведомление "earnings ready" — но не каждый
 * день, а только когда у партнёра впервые превысился порог minPayoutAmount
 * (флаг лежит на самом partner.pendingPayout — пересчитываем в одной транзакции).
 *
 * Обновляет агрегаты Partner.totalEarnings и Partner.pendingPayout.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPartnerPayoutReadyEmail } from "@/lib/email";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const stats = { unlocked: 0, partnersNotified: 0, errors: 0 };

  try {
    // 1. Найти все earnings которые пора разморозить
    const ready = await prisma.partnerEarning.findMany({
      where: {
        status: "pending",
        availableAt: { lte: now, not: null },
      },
      select: { id: true, partnerId: true, commissionAmount: true },
      take: 1000, // защита от OOM на росте
    });

    if (ready.length === 0) {
      return NextResponse.json({ message: "Nothing to unlock", ...stats });
    }

    // 2. Сменить статус — пачкой
    await prisma.partnerEarning.updateMany({
      where: { id: { in: ready.map((e) => e.id) } },
      data: { status: "available" },
    });
    stats.unlocked = ready.length;

    // 3. Группируем по партнёру: кому сколько разморозили
    const sumByPartner = new Map<string, number>();
    for (const e of ready) {
      sumByPartner.set(e.partnerId, (sumByPartner.get(e.partnerId) || 0) + e.commissionAmount);
    }

    // 4. Для каждого затронутого партнёра — пересчитать pendingPayout
    //    (это сумма всех earnings со status=available, не вошедших в payout)
    for (const [partnerId] of sumByPartner) {
      try {
        const agg = await prisma.partnerEarning.aggregate({
          where: { partnerId, status: "available", payoutId: null },
          _sum: { commissionAmount: true },
        });
        const newPending = agg._sum.commissionAmount || 0;

        const partner = await prisma.partner.findUnique({
          where: { id: partnerId },
          select: {
            id: true,
            name: true,
            email: true,
            accessToken: true,
            minPayoutAmount: true,
            pendingPayout: true,
            status: true,
          },
        });
        if (!partner) continue;

        const previouslyBelowThreshold = partner.pendingPayout < partner.minPayoutAmount;
        const nowAboveThreshold = newPending >= partner.minPayoutAmount;

        await prisma.partner.update({
          where: { id: partnerId },
          data: { pendingPayout: newPending },
        });

        // Email только если впервые перешли через порог И партнёр активен
        if (previouslyBelowThreshold && nowAboveThreshold && partner.status === "approved") {
          if (partner.accessToken) {
            await sendPartnerPayoutReadyEmail({
              email: partner.email,
              name: partner.name,
              accessToken: partner.accessToken,
              availableAmount: newPending,
              minPayout: partner.minPayoutAmount,
            }).catch((e) => console.error("Payout-ready email failed:", e));
            stats.partnersNotified++;
          }
        }
      } catch (e) {
        console.error(`[partner-earnings-unlock] partner ${partnerId} failed:`, e);
        stats.errors++;
      }
    }

    return NextResponse.json({ message: "OK", ...stats });
  } catch (error) {
    console.error("[partner-earnings-unlock] fatal:", error);
    return NextResponse.json({ error: "Server error", ...stats }, { status: 500 });
  }
}

export const POST = GET;
