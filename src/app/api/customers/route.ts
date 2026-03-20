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
    const dashboardMode = user.businesses[0].dashboardMode || "service";

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

    const [conversations, bookings, reviews, orders] = await Promise.all([
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
      dashboardMode === "sales"
        ? prisma.order.findMany({
            where: { businessId, clientTelegramId: { in: clientTelegramIds } },
            select: { clientTelegramId: true, totalPrice: true, status: true },
          })
        : Promise.resolve([]),
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

    // Orders per client (sales mode)
    const ordersByClient = new Map<string, { count: number; totalSpent: number }>();
    orders.forEach((o) => {
      if (o.clientTelegramId) {
        const key = o.clientTelegramId.toString();
        const existing = ordersByClient.get(key) || { count: 0, totalSpent: 0 };
        existing.count++;
        existing.totalSpent += o.totalPrice;
        ordersByClient.set(key, existing);
      }
    });

    const enrichedClients = clients.map((client) => {
      const telegramKey = client.telegramId.toString();
      const conversation = conversationMap.get(telegramKey);
      const clientBookings = bookingsByClient.get(telegramKey) || [];
      const clientReviews = reviewsByClient.get(telegramKey) || [];
      const clientOrders = ordersByClient.get(telegramKey) || { count: 0, totalSpent: 0 };

      const hasRecentVisit = client.lastVisitDate
        ? new Date(client.lastVisitDate) > thirtyDaysAgo
        : false;
      const hasRecentMessages = client.lastMessageAt
        ? new Date(client.lastMessageAt) > thirtyDaysAgo
        : false;
      const isActive = hasRecentVisit || hasRecentMessages || clientBookings.length > 0;
      const isVip = client.totalVisits >= 5 || clientBookings.length >= 5 || clientOrders.count >= 5;
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
        ordersCount: clientOrders.count,
        ordersTotalSpent: clientOrders.totalSpent,
        avgRating,
        segment: isVip ? "vip" : isActive ? "active" : "inactive",
        loyaltyPoints: client.loyaltyPoints,
        loyaltyVisits: client.loyaltyVisits,
        loyaltyTotalSpent: client.loyaltyTotalSpent,
        loyaltyProgramIds: client.loyaltyProgramIds,
        loyaltyCashbackPercent: client.loyaltyCashbackPercent,
        loyaltyTier: client.loyaltyTier,
      };
    });

    // Load channel leads (WA/IG/FB) that are NOT already in Client table
    // These represent customers from non-Telegram channels
    const channelLeads = await prisma.lead.findMany({
      where: {
        businessId,
        channel: { in: ["whatsapp", "instagram", "facebook"] },
        ...(search
          ? { clientName: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { lastInteractionAt: "desc" },
    });

    // Convert leads to unified customer format
    const channelCustomers = channelLeads.map((lead) => ({
      id: lead.id,
      telegramId: null,
      name: lead.clientName || "Клиент",
      phone: null,
      totalVisits: 0,
      lastVisitDate: lead.lastInteractionAt,
      isBlocked: false,
      createdAt: lead.createdAt,
      isActive: lead.lastInteractionAt
        ? new Date(lead.lastInteractionAt) > thirtyDaysAgo
        : false,
      isVip: lead.status === "client",
      messagesCount: 0,
      bookingsCount: 0,
      ordersCount: 0,
      ordersTotalSpent: 0,
      avgRating: null,
      segment: lead.status === "client" ? "vip" : lead.lastInteractionAt && new Date(lead.lastInteractionAt) > thirtyDaysAgo ? "active" : "inactive",
      channel: lead.channel,
      leadStatus: lead.status,
      loyaltyPoints: 0,
      loyaltyVisits: 0,
      loyaltyTotalSpent: 0,
      loyaltyProgramIds: [],
      loyaltyCashbackPercent: null,
      loyaltyTier: null,
    }));

    // Merge: Telegram clients + channel leads
    const allCustomers = [
      ...enrichedClients.map((c) => ({ ...c, channel: "telegram" as string, leadStatus: null as string | null })),
      ...channelCustomers,
    ];

    // Sort by last activity
    allCustomers.sort((a, b) => {
      const aDate = a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : 0;
      const bDate = b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : 0;
      return bDate - aDate;
    });

    // Stats — use counts from DB
    const [totalAll, blockedCount] = await Promise.all([
      prisma.client.count({ where: { businessId } }),
      prisma.client.count({ where: { businessId, isBlocked: true } }),
    ]);

    const stats = {
      total: totalAll + channelLeads.length,
      active: 0,
      inactive: 0,
      vip: 0,
      blocked: blockedCount,
    };

    return NextResponse.json({
      dashboardMode,
      customers: allCustomers,
      stats,
      pagination: {
        page,
        limit,
        totalCount: totalCount + channelLeads.length,
        totalPages: Math.ceil((totalCount + channelLeads.length) / limit),
      },
    });
  } catch (error) {
    console.error("Customers API error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
