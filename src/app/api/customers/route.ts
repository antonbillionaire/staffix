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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get all clients for this business
    const clients = await prisma.client.findMany({
      where: {
        businessId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { lastVisitDate: "desc" },
    });

    // Get conversations for additional data
    const conversations = await prisma.conversation.findMany({
      where: { businessId },
      include: {
        _count: { select: { messages: true } },
      },
    });

    const conversationMap = new Map(
      conversations.map((c) => [c.clientTelegramId.toString(), c])
    );

    // Get bookings for each client
    const bookings = await prisma.booking.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });

    const bookingsByClient = new Map<string, typeof bookings>();
    bookings.forEach((b) => {
      if (b.clientTelegramId) {
        const key = b.clientTelegramId.toString();
        if (!bookingsByClient.has(key)) {
          bookingsByClient.set(key, []);
        }
        bookingsByClient.get(key)!.push(b);
      }
    });

    // Get reviews
    const reviews = await prisma.review.findMany({
      where: { businessId },
    });

    const reviewsByClient = new Map<string, typeof reviews>();
    reviews.forEach((r) => {
      const key = r.clientTelegramId.toString();
      if (!reviewsByClient.has(key)) {
        reviewsByClient.set(key, []);
      }
      reviewsByClient.get(key)!.push(r);
    });

    // Enrich client data
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let enrichedClients = clients.map((client) => {
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
      const hasBookings = clientBookings.length > 0;
      const isActive = hasRecentVisit || hasRecentMessages || hasBookings;
      const isVip = client.totalVisits >= 5 || clientBookings.length >= 5;
      const avgRating =
        clientReviews.length > 0
          ? clientReviews.reduce((sum, r) => sum + r.rating, 0) /
            clientReviews.length
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
        // Computed
        isActive,
        isVip,
        messagesCount: conversation?._count?.messages || 0,
        bookingsCount: clientBookings.length,
        avgRating,
        segment: isVip ? "vip" : isActive ? "active" : "inactive",
      };
    });

    // Apply segment filter
    if (segment !== "all") {
      enrichedClients = enrichedClients.filter((c) => c.segment === segment);
    }

    // Pagination
    const totalCount = enrichedClients.length;
    const skip = (page - 1) * limit;
    const paginatedClients = enrichedClients.slice(skip, skip + limit);

    // Stats
    const stats = {
      total: clients.length,
      active: enrichedClients.filter((c) => c.isActive).length,
      inactive: enrichedClients.filter((c) => !c.isActive && !c.isVip).length,
      vip: enrichedClients.filter((c) => c.isVip).length,
      blocked: clients.filter((c) => c.isBlocked).length,
    };

    return NextResponse.json({
      customers: paginatedClients,
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
