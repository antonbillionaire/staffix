import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

/**
 * GET /api/broadcasts/preview?segment=vip|active|inactive|all
 *
 * Returns counts for the broadcast composer UI:
 * - total: clients in the selected segment (all of them, including unreachable)
 * - reachable: clients who can actually receive a Telegram message (telegramId != 0)
 *
 * Helps owners see "you'll send to N of M" before clicking Send.
 */
export async function GET(request: NextRequest) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const segment = searchParams.get("segment") || "all";

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const segmentWhere: Record<string, unknown> = {
      businessId,
      isBlocked: false,
    };

    if (segment === "vip") {
      segmentWhere.totalVisits = { gte: 5 };
    } else if (segment === "active") {
      segmentWhere.lastVisitDate = { gte: thirtyDaysAgo };
      segmentWhere.totalVisits = { lt: 5 };
    } else if (segment === "inactive") {
      segmentWhere.OR = [
        { lastVisitDate: { lt: thirtyDaysAgo } },
        { lastVisitDate: null },
      ];
    }

    const total = await prisma.client.count({ where: segmentWhere });
    const reachable = await prisma.client.count({
      where: { ...segmentWhere, telegramId: { gt: BigInt(0) } },
    });

    return NextResponse.json({
      segment,
      total,
      reachable,
      unreachable: total - reachable,
    });
  } catch (error) {
    console.error("Broadcast preview error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
