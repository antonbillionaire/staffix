/**
 * GET /api/finances?periodStart=...&periodEnd=...&staffId=...
 * Returns: per-staff salary report
 *   {
 *     staff: [
 *       {
 *         id, name, role, baseRate, commissionPercent,
 *         revenue,           // выручка с услуг/заказов за период
 *         commissionAmount,  // = revenue * commissionPercent / 100
 *         bonuses,           // сумма премий за период
 *         fines,             // сумма штрафов за период
 *         totalEarned,       // base + commission + bonuses - fines
 *         paidOut,           // сумма уже выплаченных средств
 *         toPay,             // = totalEarned - paidOut
 *         transactions: [...] // список транзакций за период
 *       }
 *     ],
 *     totals: { revenue, totalEarned, paidOut, toPay }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await prisma.business.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const periodStartStr = searchParams.get("periodStart");
  const periodEndStr = searchParams.get("periodEnd");
  const staffIdFilter = searchParams.get("staffId");

  // Default: current month
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const periodStart = periodStartStr ? new Date(periodStartStr) : defaultStart;
  const periodEnd = periodEndStr ? new Date(periodEndStr) : defaultEnd;

  try {
    // Fetch all staff (or filtered)
    const staffWhere: { businessId: string; id?: string } = { businessId: business.id };
    if (staffIdFilter) staffWhere.id = staffIdFilter;

    const staffList = await prisma.staff.findMany({
      where: staffWhere,
      orderBy: { name: "asc" },
    });

    // Get transactions for all staff in period
    const transactions = await prisma.financeTransaction.findMany({
      where: {
        businessId: business.id,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group transactions by staffId
    const txByStaff: Record<string, typeof transactions> = {};
    for (const tx of transactions) {
      if (!txByStaff[tx.staffId]) txByStaff[tx.staffId] = [];
      txByStaff[tx.staffId].push(tx);
    }

    // Calculate revenue per staff (from completed bookings + delivered orders)
    const bookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        status: "completed",
        date: { gte: periodStart, lte: periodEnd },
        staffId: { not: null },
      },
      select: { staffId: true, service: { select: { price: true } } },
    });

    const orders = await prisma.order.findMany({
      where: {
        businessId: business.id,
        status: { in: ["delivered", "completed"] },
        createdAt: { gte: periodStart, lte: periodEnd },
        staffId: { not: null },
      },
      select: { staffId: true, totalPrice: true },
    });

    const revenueByStaff: Record<string, number> = {};
    for (const b of bookings) {
      if (b.staffId && b.service?.price) {
        revenueByStaff[b.staffId] = (revenueByStaff[b.staffId] || 0) + b.service.price;
      }
    }
    for (const o of orders) {
      if (o.staffId) {
        revenueByStaff[o.staffId] = (revenueByStaff[o.staffId] || 0) + o.totalPrice;
      }
    }

    // Build response
    const staffReport = staffList.map((s) => {
      const txs = txByStaff[s.id] || [];
      const revenue = revenueByStaff[s.id] || 0;
      const commissionAmount = s.commissionPercent
        ? Math.round((revenue * s.commissionPercent) / 100)
        : 0;
      const bonuses = txs.filter((t) => t.type === "bonus").reduce((sum, t) => sum + t.amount, 0);
      const fines = txs.filter((t) => t.type === "fine").reduce((sum, t) => sum + t.amount, 0);
      const adjustments = txs.filter((t) => t.type === "adjustment").reduce((sum, t) => sum + t.amount, 0);
      const paidOut = txs.filter((t) => t.type === "payout").reduce((sum, t) => sum + t.amount, 0);

      const baseRate = s.baseRate || 0;
      const totalEarned = baseRate + commissionAmount + bonuses - fines + adjustments;
      const toPay = totalEarned - paidOut;

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        baseRate,
        commissionPercent: s.commissionPercent,
        revenue,
        commissionAmount,
        bonuses,
        fines,
        adjustments,
        totalEarned,
        paidOut,
        toPay,
        transactions: txs.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          reason: t.reason,
          createdAt: t.createdAt,
        })),
      };
    });

    const totals = staffReport.reduce(
      (acc, s) => ({
        revenue: acc.revenue + s.revenue,
        totalEarned: acc.totalEarned + s.totalEarned,
        paidOut: acc.paidOut + s.paidOut,
        toPay: acc.toPay + s.toPay,
        bonuses: acc.bonuses + s.bonuses,
        fines: acc.fines + s.fines,
      }),
      { revenue: 0, totalEarned: 0, paidOut: 0, toPay: 0, bonuses: 0, fines: 0 }
    );

    return NextResponse.json({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      staff: staffReport,
      totals,
    });
  } catch (error) {
    console.error("GET /api/finances:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/finances
 * Body: { staffId, type, amount, reason?, periodStart?, periodEnd? }
 * Create a finance transaction (bonus, fine, payout, adjustment)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await prisma.business.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { staffId, type, amount, reason, periodStart, periodEnd } = body;

    if (!staffId || !type || amount === undefined || amount === null) {
      return NextResponse.json({ error: "staffId, type, amount required" }, { status: 400 });
    }

    if (!["bonus", "fine", "payout", "adjustment"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const amountNum = Math.round(Number(amount));
    if (isNaN(amountNum) || amountNum < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Verify staff belongs to this business
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, businessId: business.id },
      select: { id: true },
    });
    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const tx = await prisma.financeTransaction.create({
      data: {
        staffId,
        type,
        amount: amountNum,
        reason: reason || null,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        businessId: business.id,
      },
    });

    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch (error) {
    console.error("POST /api/finances:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
