import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Маска email для отдачи партнёру: `iva***@mail.ru`.
 * Причина: партнёр НЕ должен видеть полные emails своих рефералов
 * (PII / GDPR / 152-ФЗ). Server-side маска — клиентскую можно обойти curl'ом.
 */
function maskEmail(email: string): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  if (at < 0) return email; // не email — не маскируем
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}***${domain}`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Токен не указан" }, { status: 400 });
  }

  try {
    const partner = await prisma.partner.findUnique({
      where: { accessToken: token },
      include: {
        referrals: {
          orderBy: { signedUpAt: "desc" },
          take: 50,
        },
        earnings: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { referral: { select: { userEmail: true } } },
        },
        payouts: {
          orderBy: { paidAt: "desc" },
          take: 24, // 2 года истории
        },
      },
    });

    // Активные promo-материалы — общие для всех партнёров.
    // Грузим отдельно, не зависят от partner. Если упадут — кабинет всё равно отдаём.
    const assets = await prisma.partnerAsset
      .findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          imageUrl: true,
          content: true,
          category: true,
          language: true,
        },
      })
      .catch(() => []);

    if (!partner) {
      return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 });
    }

    if (partner.status !== "approved") {
      return NextResponse.json({ error: "Аккаунт ещё не одобрен" }, { status: 403 });
    }

    // Summary stats — Decimal sums чтобы избежать float drift
    const totalReferrals = partner.referrals.length;
    const convertedReferrals = partner.referrals.filter((r) => r.converted).length;
    const pendingEarnings = partner.earnings
      .filter((e) => e.status === "pending")
      .reduce((sum, e) => sum.plus(e.commissionAmount), new Prisma.Decimal(0));
    const availableEarnings = partner.earnings
      .filter((e) => e.status === "available")
      .reduce((sum, e) => sum.plus(e.commissionAmount), new Prisma.Decimal(0));

    return NextResponse.json({
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        company: partner.company,
        referralCode: partner.referralCode,
        commissionRate: partner.commissionRate.toNumber(),
        minPayoutAmount: partner.minPayoutAmount.toNumber(),
        totalEarnings: partner.totalEarnings.toNumber(),
        totalPaid: partner.totalPaid.toNumber(),
        pendingPayout: partner.pendingPayout.toNumber(),
        // Реквизиты для выплат — last4 (полный номер не хранится).
        // Партнёр редактирует через PATCH /api/partners/payout-details
        cardLast4: partner.cardLast4,
        cardHolder: partner.cardHolder,
        bankName: partner.bankName,
        payoutNotes: partner.payoutNotes,
        agreementSignedAt: partner.agreementSignedAt,
        createdAt: partner.createdAt,
      },
      stats: {
        totalReferrals,
        convertedReferrals,
        conversionRate: totalReferrals > 0 ? Math.round((convertedReferrals / totalReferrals) * 100) : 0,
        pendingEarnings: pendingEarnings.toNumber(),
        availableEarnings: availableEarnings.toNumber(),
      },
      referrals: partner.referrals.map((r) => ({
        id: r.id,
        userEmail: maskEmail(r.userEmail), // server-side mask — не отдаём полные emails
        signedUpAt: r.signedUpAt,
        converted: r.converted,
        convertedAt: r.convertedAt,
        convertedPlan: r.convertedPlan,
      })),
      earnings: partner.earnings.map((e) => ({
        id: e.id,
        commissionAmount: e.commissionAmount.toNumber(),
        paymentAmount: e.paymentAmount.toNumber(),
        subscriptionPlan: e.subscriptionPlan,
        status: e.status,
        availableAt: e.availableAt,
        paidAt: e.paidAt,
        createdAt: e.createdAt,
        cancelledReason: e.cancelledReason,
        // Привязка к рефералу — партнёр видит «откуда пришёл этот earning»
        referralEmail: e.referral?.userEmail ? maskEmail(e.referral.userEmail) : null,
      })),
      payouts: partner.payouts.map((p) => ({
        id: p.id,
        amount: p.amount.toNumber(),
        periodLabel: p.periodLabel,
        reference: p.reference,
        paidAt: p.paidAt,
        // Уже храним только last4 (после миграции PCI-safety).
        recipientCardLast4: p.recipientCardLast4,
        recipientBankName: p.recipientBankName,
      })),
      assets,
    });
  } catch (e) {
    console.error("Partner dashboard error:", e);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
