import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/customers/[id]/loyalty — update client loyalty data
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: { select: { id: true } } },
    });

    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;
    const { id: clientId } = await params;

    // Verify client belongs to this business
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, amount, loyaltyProgramIds } = body;

    const updateData: Record<string, unknown> = {};

    // Handle point/visit adjustments
    if (action === "addPoints" && typeof amount === "number") {
      updateData.loyaltyPoints = { increment: Math.max(0, amount) };
    } else if (action === "subtractPoints" && typeof amount === "number") {
      const toSubtract = Math.min(amount, client.loyaltyPoints);
      updateData.loyaltyPoints = { decrement: Math.max(0, toSubtract) };
    } else if (action === "addVisits" && typeof amount === "number") {
      updateData.loyaltyVisits = { increment: Math.max(0, amount) };
    } else if (action === "addSpent" && typeof amount === "number") {
      updateData.loyaltyTotalSpent = { increment: Math.max(0, amount) };
    } else if (action === "setPrograms" && Array.isArray(loyaltyProgramIds)) {
      updateData.loyaltyProgramIds = loyaltyProgramIds;
    } else if (action === "setCashback") {
      const cashback = body.cashbackPercent;
      // null = use program default, 0-100 = custom %
      updateData.loyaltyCashbackPercent = cashback === null || cashback === undefined
        ? null
        : Math.max(0, Math.min(100, parseFloat(cashback) || 0));
    } else if (action === "setTier") {
      const tier = body.tier;
      const validTiers = ["bronze", "silver", "gold", "platinum", null];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
      }
      updateData.loyaltyTier = tier;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      client: {
        id: updated.id,
        loyaltyPoints: updated.loyaltyPoints,
        loyaltyVisits: updated.loyaltyVisits,
        loyaltyTotalSpent: updated.loyaltyTotalSpent,
        loyaltyProgramIds: updated.loyaltyProgramIds,
        loyaltyCashbackPercent: updated.loyaltyCashbackPercent,
        loyaltyTier: updated.loyaltyTier,
      },
    });
  } catch (error) {
    console.error("PATCH /api/customers/[id]/loyalty:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
