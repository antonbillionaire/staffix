/**
 * API endpoint for leads management.
 * GET /api/leads?businessId=...&status=...&channel=...
 * Returns leads list + funnel stats (cold/warm/hot/client counts).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const statusFilter = searchParams.get("status");
    const channelFilter = searchParams.get("channel");

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    // Verify ownership
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: session.user.id },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId };
    if (statusFilter) where.status = statusFilter;
    if (channelFilter) where.channel = channelFilter;

    // Get leads + stats in parallel
    const [leads, stats] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          clientName: true,
          clientId: true,
          channel: true,
          source: true,
          status: true,
          score: true,
          firstMessage: true,
          statusReason: true,
          lastInteractionAt: true,
          qualifiedAt: true,
          convertedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.lead.groupBy({
        by: ["status"],
        where: { businessId },
        _count: { id: true },
      }),
    ]);

    // Format stats into object
    const funnel = { cold: 0, warm: 0, hot: 0, client: 0 };
    for (const s of stats) {
      if (s.status in funnel) {
        funnel[s.status as keyof typeof funnel] = s._count.id;
      }
    }
    const total = funnel.cold + funnel.warm + funnel.hot + funnel.client;

    return NextResponse.json({
      leads,
      funnel,
      total,
    });
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
