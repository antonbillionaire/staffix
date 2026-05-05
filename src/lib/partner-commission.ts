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
 */

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

    // Idempotency: PayPro может прислать дубль webhook (retry, разные ipnTypeId
    // по одному order — например ORDER_CHARGED с $0 для trial signup плюс
    // TRIAL_CHARGE с реальной суммой). Если по этому orderId уже есть НЕотменённый
    // earning — возвращаем его, не дублируем.
    if (params.payproOrderId) {
      const existing = await prisma.partnerEarning.findFirst({
        where: {
          payproOrderId: params.payproOrderId,
          status: { not: "cancelled" },
        },
      });
      if (existing) {
        console.log(
          `[partner-commission] earning ${existing.id} already exists for order ${params.payproOrderId} — skip duplicate`
        );
        return existing;
      }
    }

    const commission = Math.round(params.paymentAmount * referral.partner.commissionRate * 100) / 100;
    if (commission <= 0) return null;

    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + HOLD_DAYS);

    const result = await prisma.$transaction(async (tx) => {
      const earning = await tx.partnerEarning.create({
        data: {
          commissionAmount: commission,
          paymentAmount: params.paymentAmount,
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

    // Notification — только при первой конверсии. Recurring — без email чтобы не спамить.
    if (result.isFirstConversion && referral.partner.accessToken) {
      sendPartnerReferralConvertedEmail({
        email: referral.partner.email,
        name: referral.partner.name,
        accessToken: referral.partner.accessToken,
        referralEmail: referral.userEmail,
        planName: params.planId,
        commissionAmount: commission,
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
 */
export async function cancelPartnerEarningForOrder(payproOrderId: string, reason: string) {
  try {
    const earnings = await prisma.partnerEarning.findMany({
      where: { payproOrderId },
    });

    if (earnings.length === 0) return;

    for (const earning of earnings) {
      if (earning.status === "cancelled") continue;

      if (earning.status === "paid") {
        console.warn(
          `[partner-commission] order ${payproOrderId} refunded but earning ${earning.id} ($${earning.commissionAmount}) already PAID to partner ${earning.partnerId}. Manual reversal required.`
        );
        continue;
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
        `[partner-commission] cancelled earning ${earning.id} ($${earning.commissionAmount}) — ${reason}`
      );
    }
  } catch (error) {
    console.error("[partner-commission] cancelPartnerEarningForOrder failed:", error);
  }
}
