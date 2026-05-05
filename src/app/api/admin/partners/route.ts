/**
 * Admin API для управления партнёрской программой.
 *
 * GET   /api/admin/partners — список с фильтрами + статистика
 * POST  /api/admin/partners — ручное добавление партнёра (для уже договорённых)
 *
 * Approve / reject / suspend конкретного партнёра — в /api/admin/partners/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import {
  generateReferralCode,
  generateAccessToken,
} from "@/lib/partner-helpers";
import { sendPartnerWelcomeEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all"; // pending|approved|rejected|suspended|all
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { referralCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const partners = await prisma.partner.findMany({
      where,
      include: {
        _count: {
          select: {
            referrals: true,
            earnings: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Сводка для админ-карточки
    const [stats] = await Promise.all([
      prisma.partner.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const totalEarnings = await prisma.partner.aggregate({
      _sum: {
        totalEarnings: true,
        totalPaid: true,
        pendingPayout: true,
      },
    });

    return NextResponse.json({
      partners: partners.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        company: p.company,
        website: p.website,
        referralCode: p.referralCode,
        status: p.status,
        commissionRate: p.commissionRate,
        totalEarnings: p.totalEarnings,
        totalPaid: p.totalPaid,
        pendingPayout: p.pendingPayout,
        agreementSignedAt: p.agreementSignedAt,
        approvedAt: p.approvedAt,
        createdAt: p.createdAt,
        referralsCount: p._count.referrals,
        earningsCount: p._count.earnings,
      })),
      counts: stats.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = s._count._all;
        return acc;
      }, {}),
      totals: {
        totalEarnings: totalEarnings._sum.totalEarnings || 0,
        totalPaid: totalEarnings._sum.totalPaid || 0,
        pendingPayout: totalEarnings._sum.pendingPayout || 0,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/partners:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/**
 * POST /api/admin/partners — ручное добавление партнёра.
 * Сразу approved, генерируется referralCode + accessToken, отправляется welcome email.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      company,
      website,
      description,
      commissionRate,
      adminNotes,
    } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Имя и email обязательны" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }

    const existing = await prisma.partner.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Партнёр с этим email уже существует" },
        { status: 409 }
      );
    }

    const referralCode = await generateReferralCode(name);
    const accessToken = generateAccessToken();
    const rate = typeof commissionRate === "number" ? commissionRate : 0.2;

    const partner = await prisma.partner.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        website: website?.trim() || null,
        description: description?.trim() || null,
        adminNotes: adminNotes?.trim() || null,
        referralCode,
        accessToken,
        status: "approved",
        approvedAt: new Date(),
        commissionRate: rate,
      },
    });

    // Отправляем welcome email — не падаем если письмо не ушло, партнёр в БД уже есть
    sendPartnerWelcomeEmail({
      email: partner.email,
      name: partner.name,
      referralCode,
      accessToken,
      commissionRatePercent: Math.round(rate * 100),
    }).catch((e) => console.error("Welcome email failed:", e));

    return NextResponse.json({ success: true, partner: { id: partner.id, referralCode } });
  } catch (error) {
    console.error("POST /api/admin/partners:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
