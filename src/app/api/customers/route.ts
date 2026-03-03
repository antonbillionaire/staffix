import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const segment = searchParams.get("segment") || "all"; // all, active, inactive, vip
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "20", 10) || 20;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build where clause for server-side filtering
    const baseWhere: Record<string, unknown> = {
      businessId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // Segment filter at DB level
    if (segment === "vip") {
      baseWhere.totalVisits = { gte: 5 };
    } else if (segment === "active") {
      baseWhere.totalVisits = { lt: 5 };
      baseWhere.OR = [
        { lastVisitDate: { gt: thirtyDaysAgo } },
        { lastMessageAt: { gt: thirtyDaysAgo } },
      ];
    } else if (segment === "inactive") {
      baseWhere.totalVisits = { lt: 5 };
      baseWhere.AND = [
        { OR: [{ lastVisitDate: null }, { lastVisitDate: { lte: thirtyDaysAgo } }] },
        { OR: [{ lastMessageAt: null }, { lastMessageAt: { lte: thirtyDaysAgo } }] },
      ];
    }

    // Server-side pagination
    const skip = (page - 1) * limit;
    const [clients, totalCount] = await Promise.all([
      prisma.client.findMany({
        where: baseWhere,
        orderBy: { lastVisitDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.client.count({ where: baseWhere }),
    ]);

    // Get related data only for the current page's clients
    const clientTelegramIds = clients.map((c) => c.telegramId);

    const [conversations, bookings, reviews] = await Promise.all([
      prisma.conversation.findMany({
        where: { businessId, clientTelegramId: { in: clientTelegramIds } },
        include: { _count: { select: { messages: true } } },
      }),
      prisma.booking.findMany({
        where: { businessId, clientTelegramId: { in: clientTelegramIds } },
      }),
      prisma.review.findMany({
        where: { businessId, clientTelegramId: { in: clientTelegramIds } },
      }),
    ]);

    const conversationMap = new Map(
      conversations.map((c) => [c.clientTelegramId.toString(), c])
    );

    const bookingsByClient = new Map<string, typeof bookings>();
    bookings.forEach((b) => {
      if (b.clientTelegramId) {
        const key = b.clientTelegramId.toString();
        if (!bookingsByClient.has(key)) bookingsByClient.set(key, []);
        bookingsByClient.get(key)!.push(b);
      }
    });

    const reviewsByClient = new Map<string, typeof reviews>();
    reviews.forEach((r) => {
      const key = r.clientTelegramId.toString();
      if (!reviewsByClient.has(key)) reviewsByClient.set(key, []);
      reviewsByClient.get(key)!.push(r);
    });

    const enrichedClients = clients.map((client) => {
      const telegramKey = client.telegramId.toString();
      const conversation = conversationMap.get(telegramKey);
      const clientBookings = bookingsByClient.get(telegramKey) || [];
      const clientReviews = reviewsByClient.get(telegramKey) || [];

      const hasRecentVisit = client.lastVisitDate
        ? new Date(client.lastVisitDate) > thirtyDaysAgo
        : false;
      const hasRecentMessages = client.lastMessageAt
        ? new Date(client.lastMessageAt) > thirtyDaysAgo
        : false;
      const isActive = hasRecentVisit || hasRecentMessages || clientBookings.length > 0;
      const isVip = client.totalVisits >= 5 || clientBookings.length >= 5;
      const avgRating =
        clientReviews.length > 0
          ? clientReviews.reduce((sum, r) => sum + r.rating, 0) / clientReviews.length
          : null;

      return {
        id: client.id,
        telegramId: client.telegramId.toString(),
        name: client.name || conversation?.clientName || "Клиент",
        phone: client.phone,
        totalVisits: client.totalVisits,
        lastVisitDate: client.lastVisitDate,
        isBlocked: client.isBlocked,
        createdAt: client.createdAt,
        isActive,
        isVip,
        messagesCount: conversation?._count?.messages || 0,
        bookingsCount: clientBookings.length,
        avgRating,
        segment: isVip ? "vip" : isActive ? "active" : "inactive",
      };
    });

    // Stats — use counts from DB
    const [totalAll, blockedCount] = await Promise.all([
      prisma.client.count({ where: { businessId } }),
      prisma.client.count({ where: { businessId, isBlocked: true } }),
    ]);

    const stats = {
      total: totalAll,
      active: 0, // approximate — exact would require extra queries
      inactive: 0,
      vip: 0,
      blocked: blockedCount,
    };

    return NextResponse.json({
      customers: enrichedClients,
      stats,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Customers API error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
