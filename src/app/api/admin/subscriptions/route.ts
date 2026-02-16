import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { PLANS } from "@/lib/plans";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const planFilter = searchParams.get("plan") || "all";
    const statusFilter = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};

    if (planFilter !== "all") {
      where.plan = planFilter;
    }

    if (statusFilter === "active") {
      where.expiresAt = { gte: new Date() };
      where.status = { in: ["active", "cancelled"] };
    } else if (statusFilter === "expired") {
      where.OR = [
        { expiresAt: { lt: new Date() } },
        { status: "expired" },
      ];
    } else if (statusFilter === "suspended") {
      where.status = "suspended";
    }

    if (search) {
      where.business = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ],
      };
    }

    const [subscriptions, totalCount, planCounts] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          business: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscription.count({ where }),
      // Plan distribution
      prisma.subscription.groupBy({
        by: ["plan"],
        _count: { plan: true },
      }),
    ]);

    // Calculate MRR
    const planCountMap: Record<string, number> = {};
    for (const p of planCounts) {
      planCountMap[p.plan] = p._count.plan;
    }

    let mrr = 0;
    for (const [planId, plan] of Object.entries(PLANS)) {
      mrr += (planCountMap[planId] || 0) * plan.monthlyPrice;
    }

    const activeCount = await prisma.subscription.count({
      where: { expiresAt: { gte: new Date() }, status: { in: ["active", "cancelled"] } },
    });

    return NextResponse.json({
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        messagesUsed: sub.messagesUsed,
        messagesLimit: sub.messagesLimit,
        expiresAt: sub.expiresAt,
        billingPeriod: sub.billingPeriod,
        payproOrderId: sub.payproOrderId,
        businessName: sub.business?.name || "—",
        ownerEmail: sub.business?.user?.email || "—",
        ownerName: sub.business?.user?.name || "—",
        businessId: sub.businessId,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        isExpired: new Date() > new Date(sub.expiresAt),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        mrr,
        activeCount,
        totalCount,
        planDistribution: planCountMap,
      },
    });
  } catch (error) {
    console.error("Admin subscriptions error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
