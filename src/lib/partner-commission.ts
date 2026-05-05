/**
 * Учёт партнёрской комиссии.
 *
 * Вызывается из PayPro webhook при оплатах:
 *  - первая оплата (ORDER_CHARGED / TRIAL_CHARGE) → flip referral.converted=true + создать earning
 *  - recurring (SUBSCRIPTION_CHARGE_SUCCEED) → новый earning lifetime, без flip
 *  - refund/chargeback (ORDER_REFUNDED / ORDER_CHARGED_BACK) → cancel earning по orderId
 *
 * Earning создаётся со status="pending" и availableAt=createdAt+30 дней.
 * Cron /api/cron/partner-earnings-unlock потом переводит в available.
 *
 * Партнёр должен быть status="approved" — иначе ничего не начисляем.
 *
 * Idempotency:
 *  - Schema: PartnerEarning.payproOrderId @unique (race-proof).
 *  - Сначала findUnique для fast-path при reretry от PayPro (без exception).
 *  - При параллельных webhook'ах одновременных полагаемся на unique constraint:
 *    второй .create упадёт с P2002 → ловим, возвращаем созданный первым earning.
 *
 * Деньги — Prisma.Decimal во избежание float drift при суммировании.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPartnerReferralConvertedEmail } from "@/lib/email";

const HOLD_DAYS = 30;

interface RecordEarningParams {
  userId: string;
  payproOrderId: string;
  paymentAmount: number; // в долларах, до округления
  planId: string; // starter / pro / business / enterprise
  isFirstPayment: boolean; // true для ORDER_CHARGED+TRIAL_CHARGE; false для recurring
}

/**
 * Если у user есть PartnerReferral от approved партнёра — создаёт PartnerEarning,
 * флипает converted при первой оплате и шлёт уведомление партнёру.
 *
 * Возвращает созданный earning или null если партнёрки нет.
 * Все ошибки логируются и проглатываются — оплата клиента важнее.
 */
export async function recordPartnerEarning(params: RecordEarningParams) {
  try {
    const referral = await prisma.partnerReferral.findUnique({
      where: { userId: params.userId },
      include: { partner: true },
    });

    if (!referral) return null;

    if (referral.partner.status !== "approved") {
      console.warn(
        `[partner-commission] partner ${referral.partner.id} status=${referral.partner.status} — skip earning`
      );
      return null;
    }

    if (params.paymentAmount <= 0) {
      console.warn(`[partner-commission] paymentAmount=${params.paymentAmount} <= 0 — skip`);
      return null;
    }

    // Fast-path idempotency (без транзакции): большинство дублей PayPro
    // приходят последовательно (retry), не параллельно — findUnique поймает.
    if (params.payproOrderId) {
      const existing = await prisma.partnerEarning.findUnique({
        where: { payproOrderId: params.payproOrderId },
      });
      if (existing) {
        if (existing.status !== "cancelled") {
          console.log(
            `[partner-commission] earning ${existing.id} already exists for order ${params.payproOrderId} — skip duplicate`
          );
          return existing;
        }
        // existing.status=cancelled — order был возвращён ранее, не воссоздаём.
        console.warn(
          `[partner-commission] order ${params.payproOrderId} has cancelled earning ${existing.id} — skip recreate`
        );
        return null;
      }
    }

    // commission = paymentAmount × commissionRate, округлено до центов.
    // Используем Prisma.Decimal чтобы избежать 0.1+0.2=0.30000000000000004.
    const commission = new Prisma.Decimal(params.paymentAmount)
      .times(referral.partner.commissionRate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    if (commission.lte(0)) return null;

    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + HOLD_DAYS);

    let result: { earning: Awaited<ReturnType<typeof prisma.partnerEarning.create>>; isFirstConversion: boolean };
    try {
      result = await prisma.$transaction(async (tx) => {
        const earning = await tx.partnerEarning.create({
          data: {
            commissionAmount: commission,
            paymentAmount: new Prisma.Decimal(params.paymentAmount),
            subscriptionPlan: params.planId,
            status: "pending",
            availableAt,
            payproOrderId: params.payproOrderId,
            referralId: referral.id,
            partnerId: referral.partnerId,
          },
        });

        let isFirstConversion = false;
        if (params.isFirstPayment && !referral.converted) {
          await tx.partnerReferral.update({
            where: { id: referral.id },
            data: {
              converted: true,
              convertedAt: new Date(),
              convertedPlan: params.planId,
            },
          });
          isFirstConversion = true;
        }

        await tx.partner.update({
          where: { id: referral.partnerId },
          data: { totalEarnings: { increment: commission } },
        });

        return { earning, isFirstConversion };
      });
    } catch (error) {
      // P2002 на payproOrderId = race: параллельный webhook опередил нас.
      // Транзакция откатилась → totalEarnings не инкрементнут, converted не флипнут.
      // Возвращаем earning созданный первым webhook'ом.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes("payproOrderId")
      ) {
        const winner = await prisma.partnerEarning.findUnique({
          where: { payproOrderId: params.payproOrderId },
        });
        console.log(
          `[partner-commission] race detected for order ${params.payproOrderId}, returning earning ${winner?.id} created by parallel webhook`
        );
        return winner;
      }
      throw error;
    }

    // Notification — только при первой конверсии. Recurring — без email.
    if (result.isFirstConversion && referral.partner.accessToken) {
      sendPartnerReferralConvertedEmail({
        email: referral.partner.email,
        name: referral.partner.name,
        accessToken: referral.partner.accessToken,
        referralEmail: referral.userEmail,
        planName: params.planId,
        commissionAmount: commission.toNumber(),
      }).catch((e) => console.error("[partner-commission] converted email failed:", e));
    }

    console.log(
      `[partner-commission] +$${commission.toFixed(2)} for partner ${referral.partnerId} (${params.isFirstPayment ? "first" : "recurring"} from ${params.userId})`
    );

    return result.earning;
  } catch (error) {
    console.error("[partner-commission] recordPartnerEarning failed:", error);
    return null;
  }
}

/**
 * Отменяет начисленные earnings по конкретному orderId (refund/chargeback).
 *
 * - status=pending → status=cancelled, totalEarnings -= commission
 * - status=available → status=cancelled, totalEarnings -= commission, pendingPayout -= commission
 * - status=paid → НЕ отменяем (партнёр уже получил деньги, требуется ручной разбор)
 *
 * Все обновления в одной транзакции — refund either fully reversed or not at all.
 */
export async function cancelPartnerEarningForOrder(payproOrderId: string, reason: string) {
  try {
    // Unique на payproOrderId → max один earning на orderId. Используем findUnique.
    const earning = await prisma.partnerEarning.findUnique({
      where: { payproOrderId },
    });

    if (!earning) return;
    if (earning.status === "cancelled") return;

    if (earning.status === "paid") {
      console.warn(
        `[partner-commission] order ${payproOrderId} refunded but earning ${earning.id} ($${earning.commissionAmount.toString()}) already PAID to partner ${earning.partnerId}. Manual reversal required.`
      );
      return;
    }

    const wasAvailable = earning.status === "available";

    await prisma.$transaction([
      prisma.partnerEarning.update({
        where: { id: earning.id },
        data: { status: "cancelled", cancelledReason: reason },
      }),
      prisma.partner.update({
        where: { id: earning.partnerId },
        data: {
          totalEarnings: { decrement: earning.commissionAmount },
          ...(wasAvailable ? { pendingPayout: { decrement: earning.commissionAmount } } : {}),
        },
      }),
    ]);

    console.log(
      `[partner-commission] cancelled earning ${earning.id} ($${earning.commissionAmount.toString()}) — ${reason}`
    );
  } catch (error) {
    console.error("[partner-commission] cancelPartnerEarningForOrder failed:", error);
  }
}
