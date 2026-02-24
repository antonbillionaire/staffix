import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 });
    }

    if (partner.status !== "approved") {
      return NextResponse.json({ error: "Аккаунт ещё не одобрен" }, { status: 403 });
    }

    // Summary stats
    const totalReferrals = partner.referrals.length;
    const convertedReferrals = partner.referrals.filter((r) => r.converted).length;
    const pendingEarnings = partner.earnings
      .filter((e) => e.status === "pending")
      .reduce((sum, e) => sum + e.commissionAmount, 0);

    return NextResponse.json({
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        company: partner.company,
        referralCode: partner.referralCode,
        commissionRate: partner.commissionRate,
        totalEarnings: partner.totalEarnings,
        totalPaid: partner.totalPaid,
        pendingPayout: partner.pendingPayout,
        createdAt: partner.createdAt,
      },
      stats: {
        totalReferrals,
        convertedReferrals,
        conversionRate: totalReferrals > 0 ? Math.round((convertedReferrals / totalReferrals) * 100) : 0,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
      },
      referrals: partner.referrals.map((r) => ({
        id: r.id,
        userEmail: r.userEmail,
        signedUpAt: r.signedUpAt,
        converted: r.converted,
        convertedAt: r.convertedAt,
        convertedPlan: r.convertedPlan,
      })),
      earnings: partner.earnings.map((e) => ({
        id: e.id,
        commissionAmount: e.commissionAmount,
        paymentAmount: e.paymentAmount,
        subscriptionPlan: e.subscriptionPlan,
        status: e.status,
        paidAt: e.paidAt,
        createdAt: e.createdAt,
      })),
    });
  } catch (e) {
    console.error("Partner dashboard error:", e);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
