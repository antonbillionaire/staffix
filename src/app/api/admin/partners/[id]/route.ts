/**
 * Admin API для управления конкретным партнёром.
 *
 * GET    /api/admin/partners/[id] — детали + статистика + последние рефералы и earnings.
 *                                   accessToken НЕ отдаём (XSS на admin = слив всех кабинетов).
 *                                   cardLast4 отдаём (нужен админу для банк-перевода).
 * PATCH  /api/admin/partners/[id] — действия по action: approve, reject, suspend, resume,
 *                                   update_rate, update_min_payout, update_admin_notes,
 *                                   update_payout, mark_agreement_signed, resend_welcome_email,
 *                                   rotate_token.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import {
  generateReferralCode,
  generateAccessToken,
} from "@/lib/partner-helpers";
import {
  sendPartnerWelcomeEmail,
  sendPartnerRejectionEmail,
  sendPartnerAccessRotatedEmail,
} from "@/lib/email";

// Whitelist полей для GET — explicit select безопаснее чем omit:
// если в схеме появится новое чувствительное поле, оно НЕ попадёт в API.
const ADMIN_PARTNER_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  website: true,
  description: true,
  referralCode: true,
  // accessToken НЕ включаем — XSS на admin = слив всех кабинетов
  status: true,
  approvedAt: true,
  commissionRate: true,
  totalEarnings: true,
  totalPaid: true,
  pendingPayout: true,
  minPayoutAmount: true,
  cardLast4: true,
  cardHolder: true,
  bankName: true,
  payoutNotes: true,
  adminNotes: true,
  agreementSignedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Базовые поля партнёра + ВСЕ рефералы с их earnings (для per-client агрегатов)
    const partner = await prisma.partner.findUnique({
      where: { id },
      select: {
        ...ADMIN_PARTNER_FIELDS,
        referrals: {
          orderBy: { signedUpAt: "desc" },
          include: {
            earnings: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                commissionAmount: true,
                paymentAmount: true,
                subscriptionPlan: true,
                status: true,
                createdAt: true,
                paidAt: true,
              },
            },
          },
        },
        earnings: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 });
    }

    // ── Per-client агрегаты ─────────────────────────────────────────
    // Для каждого реферала: сколько раз заплатил, сколько принёс, сколько
    // комиссии партнёру, последний платёж, MRR (если активный платящий).
    // cancelled earnings исключаем из «принесли/комиссия» — это refund'ы.
    const clients = partner.referrals.map((r) => {
      const activeEarnings = r.earnings.filter((e) => e.status !== "cancelled");
      const totalRevenue = activeEarnings.reduce(
        (s, e) => s.plus(e.paymentAmount),
        new Prisma.Decimal(0)
      );
      const totalCommission = activeEarnings.reduce(
        (s, e) => s.plus(e.commissionAmount),
        new Prisma.Decimal(0)
      );
      const lastPayment = activeEarnings[0]?.createdAt ?? null;
      const cancelledCount = r.earnings.filter((e) => e.status === "cancelled").length;
      return {
        id: r.id,
        userEmail: r.userEmail,
        signedUpAt: r.signedUpAt,
        converted: r.converted,
        convertedAt: r.convertedAt,
        convertedPlan: r.convertedPlan,
        paymentsCount: activeEarnings.length,
        cancelledCount,
        totalRevenue: totalRevenue.toNumber(),
        totalCommission: totalCommission.toNumber(),
        lastPaymentAt: lastPayment,
      };
    });

    // ── Lifetime агрегаты (свежесчитанные, не из Partner.totalEarnings) ─
    // Для cross-check: должны совпадать с totalEarnings в Partner.
    const allActiveEarnings = partner.earnings.filter((e) => e.status !== "cancelled");
    const lifetimeRevenue = clients.reduce((s, c) => s + c.totalRevenue, 0);
    const lifetimeCommission = clients.reduce((s, c) => s + c.totalCommission, 0);
    const convertedClients = clients.filter((c) => c.converted).length;
    const payingClients = clients.filter((c) => c.paymentsCount > 0).length;
    const avgRevenuePerClient = payingClients > 0 ? lifetimeRevenue / payingClients : 0;
    const avgCommissionPerClient = payingClients > 0 ? lifetimeCommission / payingClients : 0;
    const avgPaymentsPerClient =
      payingClients > 0
        ? clients.reduce((s, c) => s + c.paymentsCount, 0) / payingClients
        : 0;

    // ── Помесячная динамика за 12 месяцев ───────────────────────────
    // signups: PartnerReferral.signedUpAt в этом месяце
    // conversions: PartnerReferral.convertedAt в этом месяце
    // revenue / commission: PartnerEarning.createdAt в этом месяце (без cancelled)
    const now = new Date();
    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const months: Array<{
      key: string;
      label: string;
      signups: number;
      conversions: number;
      revenue: number;
      commission: number;
    }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: monthKey(d),
        label: d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }),
        signups: 0,
        conversions: 0,
        revenue: 0,
        commission: 0,
      });
    }
    const monthByKey = new Map(months.map((m) => [m.key, m]));

    for (const r of partner.referrals) {
      const su = monthByKey.get(monthKey(r.signedUpAt));
      if (su) su.signups++;
      if (r.convertedAt) {
        const cv = monthByKey.get(monthKey(r.convertedAt));
        if (cv) cv.conversions++;
      }
    }
    for (const e of allActiveEarnings) {
      const m = monthByKey.get(monthKey(e.createdAt));
      if (m) {
        m.revenue += e.paymentAmount.toNumber();
        m.commission += e.commissionAmount.toNumber();
      }
    }

    // Decimal → number для UI
    const partnerForUi = {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      company: partner.company,
      website: partner.website,
      description: partner.description,
      referralCode: partner.referralCode,
      status: partner.status,
      approvedAt: partner.approvedAt,
      commissionRate: partner.commissionRate.toNumber(),
      totalEarnings: partner.totalEarnings.toNumber(),
      totalPaid: partner.totalPaid.toNumber(),
      pendingPayout: partner.pendingPayout.toNumber(),
      minPayoutAmount: partner.minPayoutAmount.toNumber(),
      cardLast4: partner.cardLast4,
      cardHolder: partner.cardHolder,
      bankName: partner.bankName,
      payoutNotes: partner.payoutNotes,
      adminNotes: partner.adminNotes,
      agreementSignedAt: partner.agreementSignedAt,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
      // Не дублируем referrals — в clients[] уже всё что нужно для UI.
      // earnings оставляем для истории-таблицы.
      earnings: partner.earnings.map((e) => ({
        ...e,
        commissionAmount: e.commissionAmount.toNumber(),
        paymentAmount: e.paymentAmount.toNumber(),
      })),
    };

    return NextResponse.json({
      partner: partnerForUi,
      clients,
      monthly: months,
      lifetime: {
        totalReferrals: clients.length,
        convertedClients,
        payingClients,
        conversionRate:
          clients.length > 0 ? Math.round((convertedClients / clients.length) * 100) : 0,
        revenueBrought: lifetimeRevenue,
        commissionEarned: lifetimeCommission,
        avgRevenuePerClient: Math.round(avgRevenuePerClient * 100) / 100,
        avgCommissionPerClient: Math.round(avgCommissionPerClient * 100) / 100,
        avgPaymentsPerClient: Math.round(avgPaymentsPerClient * 10) / 10,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/partners/[id]:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) {
      return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 });
    }

    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case "approve": {
        if (partner.status === "approved") {
          return NextResponse.json({ error: "Партнёр уже одобрен" }, { status: 400 });
        }

        // Генерируем код и токен только если ещё нет
        const referralCode = partner.referralCode || (await generateReferralCode(partner.name));
        const accessToken = partner.accessToken || generateAccessToken();

        const updated = await prisma.partner.update({
          where: { id },
          data: {
            status: "approved",
            approvedAt: new Date(),
            referralCode,
            accessToken,
          },
        });

        sendPartnerWelcomeEmail({
          email: updated.email,
          name: updated.name,
          referralCode,
          accessToken,
          commissionRatePercent: Math.round(updated.commissionRate.toNumber() * 100),
        }).catch((e) => console.error("Welcome email failed:", e));

        return NextResponse.json({
          success: true,
          partner: { id: updated.id, referralCode, status: updated.status },
        });
      }

      case "reject": {
        if (partner.status !== "pending") {
          return NextResponse.json(
            { error: `Нельзя отклонить партнёра в статусе "${partner.status}"` },
            { status: 400 }
          );
        }
        const reason = typeof body.reason === "string" ? body.reason : undefined;

        await prisma.partner.update({
          where: { id },
          data: { status: "rejected", adminNotes: reason ? `[reject] ${reason}` : partner.adminNotes },
        });

        sendPartnerRejectionEmail({
          email: partner.email,
          name: partner.name,
          reason,
        }).catch((e) => console.error("Rejection email failed:", e));

        return NextResponse.json({ success: true });
      }

      case "suspend": {
        if (partner.status !== "approved") {
          return NextResponse.json(
            { error: "Suspend доступен только для approved партнёров" },
            { status: 400 }
          );
        }
        const reason = typeof body.reason === "string" ? body.reason : "no reason given";
        await prisma.partner.update({
          where: { id },
          data: {
            status: "suspended",
            adminNotes: `[suspend ${new Date().toISOString().slice(0, 10)}] ${reason}\n${partner.adminNotes || ""}`.trim(),
          },
        });
        return NextResponse.json({ success: true });
      }

      case "resume": {
        if (partner.status !== "suspended") {
          return NextResponse.json(
            { error: "Resume доступен только для suspended партнёров" },
            { status: 400 }
          );
        }
        await prisma.partner.update({
          where: { id },
          data: { status: "approved" },
        });
        return NextResponse.json({ success: true });
      }

      case "update_rate": {
        const rate = Number(body.commissionRate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
          return NextResponse.json(
            { error: "commissionRate должно быть от 0 до 1 (например 0.2 = 20%)" },
            { status: 400 }
          );
        }
        await prisma.partner.update({
          where: { id },
          data: { commissionRate: rate },
        });
        return NextResponse.json({ success: true, commissionRate: rate });
      }

      case "update_min_payout": {
        const min = Number(body.minPayoutAmount);
        if (!Number.isFinite(min) || min < 0) {
          return NextResponse.json(
            { error: "minPayoutAmount должно быть >= 0" },
            { status: 400 }
          );
        }
        await prisma.partner.update({
          where: { id },
          data: { minPayoutAmount: min },
        });
        return NextResponse.json({ success: true, minPayoutAmount: min });
      }

      case "update_admin_notes": {
        const notes = typeof body.adminNotes === "string" ? body.adminNotes : "";
        await prisma.partner.update({
          where: { id },
          data: { adminNotes: notes || null },
        });
        return NextResponse.json({ success: true });
      }

      case "update_payout": {
        // Реквизиты для выплаты — обновляются и админом, и партнёром (через свой API).
        // cardLast4 — только 4 цифры (полный PAN не храним).
        const { cardLast4, cardHolder, bankName, payoutNotes } = body;
        const last4 = typeof cardLast4 === "string" ? cardLast4.replace(/\D/g, "").slice(-4) : "";
        if (cardLast4 && (last4.length !== 4)) {
          return NextResponse.json(
            { error: "cardLast4 должно быть 4 цифры" },
            { status: 400 }
          );
        }
        await prisma.partner.update({
          where: { id },
          data: {
            cardLast4: last4 || null,
            cardHolder: cardHolder?.trim() || null,
            bankName: bankName?.trim() || null,
            payoutNotes: payoutNotes?.trim() || null,
          },
        });
        return NextResponse.json({ success: true });
      }

      case "mark_agreement_signed": {
        await prisma.partner.update({
          where: { id },
          data: { agreementSignedAt: new Date() },
        });
        return NextResponse.json({ success: true });
      }

      case "resend_welcome_email": {
        if (partner.status !== "approved" || !partner.referralCode || !partner.accessToken) {
          return NextResponse.json(
            { error: "Email можно отправить только одобренному партнёру" },
            { status: 400 }
          );
        }
        await sendPartnerWelcomeEmail({
          email: partner.email,
          name: partner.name,
          referralCode: partner.referralCode,
          accessToken: partner.accessToken,
          commissionRatePercent: Math.round(partner.commissionRate.toNumber() * 100),
        });
        return NextResponse.json({ success: true });
      }

      case "rotate_token": {
        // Регенерация accessToken — для случая «партнёр потерял ссылку» или
        // «есть подозрения что токен утёк». Старая ссылка перестаёт работать.
        if (partner.status !== "approved") {
          return NextResponse.json(
            { error: "Ротация токена доступна только для approved партнёров" },
            { status: 400 }
          );
        }
        const newToken = generateAccessToken();
        await prisma.partner.update({
          where: { id },
          data: { accessToken: newToken },
        });

        sendPartnerAccessRotatedEmail({
          email: partner.email,
          name: partner.name,
          accessToken: newToken,
        }).catch((e) => console.error("Access-rotated email failed:", e));

        // Возвращаем БЕЗ нового токена — админ его не должен видеть, только партнёр в email
        return NextResponse.json({ success: true, message: "Токен пересоздан и отправлен партнёру на email" });
      }

      default:
        return NextResponse.json(
          { error: `Неизвестное действие: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("PATCH /api/admin/partners/[id]:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
