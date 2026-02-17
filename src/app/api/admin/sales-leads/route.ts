import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const stageFilter = searchParams.get("stage") || "all";
    const channelFilter = searchParams.get("channel") || "all";
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};

    if (stageFilter !== "all") {
      where.stage = stageFilter;
    }

    if (channelFilter !== "all") {
      where.channel = channelFilter;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { businessName: { contains: search, mode: "insensitive" } },
        { telegramUsername: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [leads, totalCount, stageCounts] = await Promise.all([
      prisma.salesLead.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.salesLead.count({ where }),
      prisma.salesLead.groupBy({
        by: ["stage"],
        _count: { stage: true },
      }),
    ]);

    const stageDistribution: Record<string, number> = {};
    for (const s of stageCounts) {
      stageDistribution[s.stage] = s._count.stage;
    }

    // Serialize BigInt fields
    const serializedLeads = leads.map((lead) => ({
      ...lead,
      telegramId: lead.telegramId?.toString() || null,
      telegramChatId: lead.telegramChatId?.toString() || null,
    }));

    return NextResponse.json({
      leads: serializedLeads,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        total: totalCount,
        stageDistribution,
      },
    });
  } catch (error) {
    console.error("Admin sales leads error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
