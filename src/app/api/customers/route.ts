import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const businessId = business.id;
    const dashboardMode = business.dashboardMode || "service";

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

    // Sprint 3: Client.telegramId стал nullable. Для смежных таблиц которые
    // всё ещё привязаны к TG (Conversation/Booking/Review/Order.clientTelegramId
    // остаются BigInt), пропускаем клиентов без TG-идентичности. Их бронирования
    // и разговоры лежат в отдельных ветках (booking через ChannelClient path
    // до Sprint 3 merge — этот блок починится там).
    const clientTelegramIds: bigint[] = clients
      .map((c) => c.telegramId)
      .filter((id): id is bigint => id !== null);

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
      // Для non-TG клиентов telegramKey = null → карты для них дадут пустые
      // коллекции. После Sprint 3 backfill эти клиенты получат свои channel-id
      // и здесь появится вторая ветка поиска.
      const telegramKey = client.telegramId ? client.telegramId.toString() : null;
      const conversation = telegramKey ? conversationMap.get(telegramKey) : undefined;
      const clientBookings = telegramKey ? (bookingsByClient.get(telegramKey) || []) : [];
      const clientReviews = telegramKey ? (reviewsByClient.get(telegramKey) || []) : [];
      const clientOrders = telegramKey ? (ordersByClient.get(telegramKey) || { count: 0, totalSpent: 0 }) : { count: 0, totalSpent: 0 };

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

      // Sprint 4A: список каналов клиента для UI-бейджей. Non-null поле =
      // клиент когда-то писал через этот канал, значит показываем иконку.
      const channels: string[] = [];
      if (client.telegramId) channels.push("telegram");
      if (client.whatsappId) channels.push("whatsapp");
      if (client.instagramId) channels.push("instagram");
      if (client.fbPsid) channels.push("facebook");

      return {
        id: client.id,
        telegramId: client.telegramId ? client.telegramId.toString() : null,
        telegramUsername: client.telegramUsername,
        whatsappId: client.whatsappId ?? null,
        instagramId: client.instagramId ?? null,
        fbPsid: client.fbPsid ?? null,
        channels,
        name: client.name || conversation?.clientName || "Клиент",
        phone: client.phone,
        totalVisits: client.totalVisits,
        lastVisitDate: client.lastVisitDate,
        isBlocked: client.isBlocked,
        createdAt: client.createdAt,
        isActive,
        isVip,
        messagesCount: conversation?._count?.messages ?? 0,
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
        dealStage: client.dealStage,
        dealValue: client.dealValue,
        dealClosedAt: client.dealClosedAt,
        dealNote: client.dealNote,
        assignedStaffId: client.assignedStaffId,
      };
    });

    // Список сотрудников бизнеса — для inline-переназначения в таблице.
    const staffList = await prisma.staff.findMany({
      where: { businessId },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
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
      include: {
        client: {
          select: { telegramUsername: true, instagramUsername: true },
        },
      },
      orderBy: { lastInteractionAt: "desc" },
    });

    // Convert leads to unified customer format
    const channelCustomers = channelLeads.map((lead) => ({
      id: lead.id,
      telegramId: null,
      telegramUsername: lead.client?.telegramUsername ?? null,
      whatsappId: null as string | null,
      instagramId: null as string | null,
      fbPsid: null as string | null,
      instagramUsername: lead.client?.instagramUsername ?? null,
      // Channel leads по природе относятся к своему одному каналу — берём из lead.channel.
      // Нормализуем "messenger" → "facebook" для совместимости с UI-иконками.
      channels: [lead.channel === "messenger" ? "facebook" : lead.channel],
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
      // Channel leads (WA/IG/FB) живут в Lead, у них нет deal-pipeline полей
      // в схеме. Маппим Lead.status в dealStage для совместимости с UI.
      dealStage: lead.status === "client" ? "client" : "lead",
      dealValue: null as number | null,
      dealClosedAt: null as Date | null,
      dealNote: null as string | null,
    }));

    // Merge: Telegram clients + channel leads
    const allCustomers = [
      ...enrichedClients.map((c) => ({ ...c, instagramUsername: null as string | null, channel: "telegram" as string, leadStatus: null as string | null })),
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
      staffList,
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
