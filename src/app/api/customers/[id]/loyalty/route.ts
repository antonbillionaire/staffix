import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";
import {
  writeLoyaltyLedger,
  readLoyaltyLedger,
  isReasonableManualPoints,
} from "@/lib/loyalty-ledger";

// GET /api/customers/[id]/loyalty — история движений баллов (Sprint 4E)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: clientId } = await params;

    // Tenant isolation: клиент должен быть в этом бизнесе
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId },
      select: { id: true, loyaltyPoints: true, loyaltyVisits: true, loyaltyTotalSpent: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const entries = await readLoyaltyLedger(businessId, clientId, 100);

    return NextResponse.json({
      balance: client.loyaltyPoints,
      visits: client.loyaltyVisits,
      totalSpent: client.loyaltyTotalSpent,
      entries,
    });
  } catch (error) {
    console.error("GET /api/customers/[id]/loyalty:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/customers/[id]/loyalty — update client loyalty data
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: clientId } = await params;

    // Verify client belongs to this business
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, amount, loyaltyProgramIds, reason } = body;

    // Начисление/списание баллов идёт через ledger — чтобы в истории
    // клиента появилась запись «менеджер начислил 500 бонусов».
    if (action === "addPoints" && typeof amount === "number") {
      if (!isReasonableManualPoints(amount) || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      await writeLoyaltyLedger({
        businessId,
        clientId,
        kind: "manual",
        points: amount,
        reason: typeof reason === "string" ? reason.slice(0, 200) : null,
        createdBy: "manager",
      });
    } else if (action === "subtractPoints" && typeof amount === "number") {
      if (!isReasonableManualPoints(amount) || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      await writeLoyaltyLedger({
        businessId,
        clientId,
        kind: "manual",
        points: -amount,
        reason: typeof reason === "string" ? reason.slice(0, 200) : null,
        createdBy: "manager",
      });
    } else if (action === "addVisits" && typeof amount === "number") {
      await prisma.client.update({
        where: { id: clientId },
        data: { loyaltyVisits: { increment: Math.max(0, amount) } },
      });
    } else if (action === "addSpent" && typeof amount === "number") {
      await prisma.client.update({
        where: { id: clientId },
        data: { loyaltyTotalSpent: { increment: Math.max(0, amount) } },
      });
    } else if (action === "setPrograms" && Array.isArray(loyaltyProgramIds)) {
      await prisma.client.update({
        where: { id: clientId },
        data: { loyaltyProgramIds },
      });
    } else if (action === "setCashback") {
      const cashback = body.cashbackPercent;
      await prisma.client.update({
        where: { id: clientId },
        data: {
          loyaltyCashbackPercent:
            cashback === null || cashback === undefined
              ? null
              : Math.max(0, Math.min(100, parseFloat(cashback) || 0)),
        },
      });
    } else if (action === "setTier") {
      const tier = body.tier;
      const validTiers = ["bronze", "silver", "gold", "platinum", null];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
      }
      await prisma.client.update({
        where: { id: clientId },
        data: { loyaltyTier: tier },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Reload client for the fresh state after any of the branches above
    const updated = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        loyaltyPoints: true,
        loyaltyVisits: true,
        loyaltyTotalSpent: true,
        loyaltyProgramIds: true,
        loyaltyCashbackPercent: true,
        loyaltyTier: true,
      },
    });

    return NextResponse.json({ success: true, client: updated });
  } catch (error) {
    console.error("PATCH /api/customers/[id]/loyalty:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
