import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserBusiness(): Promise<string | null> {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) return null;

  const business = await prisma.business.findFirst({
    where: { userId },
    select: { id: true },
  });
  return business?.id || null;
}

// GET /api/loyalty — get all loyalty programs for business
export async function GET() {
  try {
    const businessId = await getUserBusiness();
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const programs = await prisma.loyaltyProgram.findMany({
      where: { businessId },
      orderBy: { type: "asc" },
    });

    // Stats
    const clientStats = await prisma.client.aggregate({
      where: { businessId, loyaltyPoints: { gt: 0 } },
      _count: true,
      _sum: { loyaltyPoints: true },
    });

    return NextResponse.json({
      programs,
      // Backward compat: return first program as "program"
      program: programs.length > 0 ? programs[0] : null,
      stats: {
        activeMembers: clientStats._count || 0,
        totalPointsIssued: clientStats._sum?.loyaltyPoints || 0,
      },
    });
  } catch (error) {
    console.error("GET /api/loyalty:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/loyalty — create or update loyalty program by type
export async function POST(request: NextRequest) {
  try {
    const businessId = await getUserBusiness();
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      enabled,
      type,
      name,
      cashbackPercent,
      visitsForReward,
      rewardType,
      rewardDiscount,
      tiers,
    } = body;

    const programType = type || "cashback";

    const data = {
      enabled: !!enabled,
      type: programType,
      name: name || null,
      cashbackPercent: cashbackPercent !== undefined ? parseInt(cashbackPercent) || 5 : 5,
      visitsForReward: visitsForReward !== undefined ? parseInt(visitsForReward) || 10 : 10,
      rewardType: rewardType || "discount",
      rewardDiscount: rewardDiscount !== undefined ? parseInt(rewardDiscount) || 50 : 50,
      tiers: tiers || null,
    };

    // Upsert by businessId + type (unique constraint)
    const program = await prisma.loyaltyProgram.upsert({
      where: {
        businessId_type: { businessId, type: programType },
      },
      create: { businessId, ...data },
      update: data,
    });

    return NextResponse.json({ success: true, program });
  } catch (error) {
    console.error("POST /api/loyalty:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
