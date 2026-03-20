import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "week";

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let prevStartDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
        prevStartDate = new Date(0);
    }

    // Find user's business
    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({
        totalMessages: 0,
        totalBookings: 0,
        totalClients: 0,
        avgResponseTime: 0,
        conversionRate: 0,
        popularQuestions: [],
        messagesByDay: [],
      });
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ========= PARALLEL BATCH: All independent queries =========
    const [
      // Core stats
      totalMessages,
      totalBookings,
      conversations,
      messages,
      userMessages,
      clients,
      bookingStatusCounts,
      completedBookings,
      broadcastsSent,
      reviews,
      // Previous period (for trends)
      prevMessages,
      prevBookings,
      prevConversations,
      prevOrders,
      // Order stats
      totalOrders,
      orderStatusCounts,
      orderRevenueAgg,
      ordersList,
      orderItems,
      // Channel & response time
      channelMessageCounts,
      recentConversations,
    ] = await Promise.all([
      // --- Core stats ---
      prisma.message.count({
        where: {
          conversation: { businessId: business.id },
          createdAt: { gte: startDate },
        },
      }),
      prisma.booking.count({
        where: {
          businessId: business.id,
          createdAt: { gte: startDate },
        },
      }),
      prisma.conversation.findMany({
        where: {
          businessId: business.id,
          createdAt: { gte: startDate },
        },
        select: { clientTelegramId: true },
        distinct: ["clientTelegramId"],
      }),
      prisma.message.findMany({
        where: {
          conversation: { businessId: business.id },
          createdAt: { gte: startDate },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.message.findMany({
        where: {
          conversation: { businessId: business.id },
          role: "user",
          createdAt: { gte: startDate },
        },
        select: { content: true },
      }),
      prisma.client.findMany({
        where: { businessId: business.id },
        select: { totalVisits: true, lastVisitDate: true },
      }),
      prisma.booking.groupBy({
        by: ["status"],
        where: { businessId: business.id, createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.booking.findMany({
        where: {
          businessId: business.id,
          status: "completed",
          createdAt: { gte: startDate },
        },
        include: { service: { select: { price: true } } },
      }),
      prisma.clientBroadcast.count({
        where: {
          businessId: business.id,
          status: "sent",
          createdAt: { gte: startDate },
        },
      }),
      prisma.review.findMany({
        where: { businessId: business.id, createdAt: { gte: startDate } },
        select: { rating: true },
      }),
      // --- Previous period (for trends) ---
      period !== "all" ? prisma.message.count({
        where: {
          conversation: { businessId: business.id },
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }) : Promise.resolve(0),
      period !== "all" ? prisma.booking.count({
        where: {
          businessId: business.id,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }) : Promise.resolve(0),
      period !== "all" ? prisma.conversation.findMany({
        where: {
          businessId: business.id,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
        select: { clientTelegramId: true },
        distinct: ["clientTelegramId"],
      }) : Promise.resolve([]),
      period !== "all" ? prisma.order.count({
        where: {
          businessId: business.id,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }) : Promise.resolve(0),
      // --- Order stats ---
      prisma.order.count({
        where: { businessId: business.id, createdAt: { gte: startDate } },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { businessId: business.id, createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { businessId: business.id, createdAt: { gte: startDate } },
        _sum: { totalPrice: true },
        _avg: { totalPrice: true },
      }),
      prisma.order.findMany({
        where: { businessId: business.id, createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.orderItem.findMany({
        where: {
          order: { businessId: business.id, createdAt: { gte: startDate } },
        },
        select: { name: true, quantity: true, price: true },
      }),
      // --- Channel & response time ---
      prisma.channelMessage.groupBy({
        by: ["channel"],
        where: { businessId: business.id, createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.conversation.findMany({
        where: { businessId: business.id },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 100,
            where: { createdAt: { gte: startDate } },
          },
        },
        take: 20,
      }),
    ]);

    // ========= Process results (pure computation, no DB) =========

    // Unique clients
    const totalClients = conversations.length;

    // Calculate conversion rate
    const conversionRate = totalClients > 0
      ? Math.round((totalBookings / totalClients) * 100)
      : 0;

    // Group messages by day
    const messagesByDayMap = new Map<string, number>();
    messages.forEach((msg) => {
      const dateStr = msg.createdAt.toISOString().split("T")[0];
      messagesByDayMap.set(dateStr, (messagesByDayMap.get(dateStr) || 0) + 1);
    });

    // Show appropriate number of days based on period, zero-fill missing days
    const maxDays = period === "week" ? 7 : period === "month" ? 30 : 90;
    const messagesByDay: { date: string; count: number }[] = [];
    if (period !== "all") {
      // Fill all days in the range with 0s, then overlay actual data
      for (let i = maxDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        messagesByDay.push({ date: dateStr, count: messagesByDayMap.get(dateStr) || 0 });
      }
    } else {
      // "All time" — just show days that have data
      const entries = Array.from(messagesByDayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .slice(-maxDays);
      messagesByDay.push(...entries);
    }

    // Keyword-based grouping: normalize messages and group similar ones
    const questionCounts = new Map<string, { display: string; count: number }>();
    userMessages.forEach((msg) => {
      const text = msg.content.trim();
      if (text.length < 3) return; // Skip very short messages like "Да", "Ок"

      // Normalize: lowercase, remove punctuation, collapse whitespace
      const normalized = text.toLowerCase()
        .replace(/[.,!?;:()"\-—–…]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 80);

      if (!normalized) return;

      const existing = questionCounts.get(normalized);
      if (existing) {
        existing.count++;
      } else {
        // Keep original text as display, truncated
        const display = text.length > 60 ? text.substring(0, 60) + "..." : text;
        questionCounts.set(normalized, { display, count: 1 });
      }
    });

    const popularQuestions = Array.from(questionCounts.values())
      .filter((q) => q.count >= 2) // Only show questions asked at least twice
      .map(({ display, count }) => ({ question: display, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // If no repeated questions, show top single ones
    if (popularQuestions.length === 0) {
      const topSingle = Array.from(questionCounts.values())
        .map(({ display, count }) => ({ question: display, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      popularQuestions.push(...topSingle);
    }

    // Customer segments
    const customerSegments = {
      vip: clients.filter((c) => c.totalVisits >= 5).length,
      active: clients.filter(
        (c) => c.totalVisits < 5 && c.lastVisitDate && new Date(c.lastVisitDate) > thirtyDaysAgo
      ).length,
      inactive: clients.filter(
        (c) => !c.lastVisitDate || new Date(c.lastVisitDate) <= thirtyDaysAgo
      ).length,
    };

    // Bookings by status
    const bookingsByStatus = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    bookingStatusCounts.forEach((item) => {
      if (item.status in bookingsByStatus) {
        bookingsByStatus[item.status as keyof typeof bookingsByStatus] = item._count;
      }
    });

    // Total revenue from completed bookings
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);

    // Average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    // Trends
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Order stats processing
    const ordersByStatus: Record<string, number> = {};
    orderStatusCounts.forEach((item) => {
      ordersByStatus[item.status] = item._count;
    });

    const orderRevenue = orderRevenueAgg._sum?.totalPrice || 0;
    const avgOrderValue = Math.round(orderRevenueAgg._avg?.totalPrice || 0);

    // Orders by day
    const ordersByDayMap = new Map<string, number>();
    ordersList.forEach((o) => {
      const dateStr = o.createdAt.toISOString().split("T")[0];
      ordersByDayMap.set(dateStr, (ordersByDayMap.get(dateStr) || 0) + 1);
    });
    const ordersByDay = Array.from(ordersByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .slice(-maxDays);

    // Popular products (top items in orders)
    const productPopularity = new Map<string, { count: number; revenue: number }>();
    orderItems.forEach((item) => {
      const existing = productPopularity.get(item.name) || { count: 0, revenue: 0 };
      existing.count += item.quantity;
      existing.revenue += item.price * item.quantity;
      productPopularity.set(item.name, existing);
    });
    const popularProducts = Array.from(productPopularity.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Channel-specific message counts
    const messagesByChannel: Record<string, number> = {};
    channelMessageCounts.forEach((item) => {
      messagesByChannel[item.channel] = item._count;
    });

    // Calculate average response time from message pairs
    let totalResponseMs = 0;
    let responseCount = 0;
    for (const conv of recentConversations) {
      for (let i = 1; i < conv.messages.length; i++) {
        if (conv.messages[i].role === "assistant" && conv.messages[i - 1].role === "user") {
          const diff = new Date(conv.messages[i].createdAt).getTime() - new Date(conv.messages[i - 1].createdAt).getTime();
          if (diff > 0 && diff < 300000) { // less than 5 minutes
            totalResponseMs += diff;
            responseCount++;
          }
        }
      }
    }
    const avgResponseTime = responseCount > 0
      ? Math.round(totalResponseMs / responseCount / 1000) // seconds
      : 0;

    // Conversion rate depends on business mode
    const isSalesMode = business.dashboardMode === "sales";
    const conversionRateAdjusted = isSalesMode
      ? (totalClients > 0 ? Math.round((totalOrders / totalClients) * 100) : 0)
      : conversionRate;

    return NextResponse.json({
      dashboardMode: business.dashboardMode || "service",
      totalMessages,
      totalBookings,
      totalClients: clients.length || totalClients,
      avgResponseTime,
      conversionRate: conversionRateAdjusted,
      popularQuestions,
      messagesByDay,
      // Trends
      trends: {
        messages: calcTrend(totalMessages, prevMessages),
        bookings: calcTrend(totalBookings, prevBookings),
        clients: calcTrend(totalClients, prevConversations.length),
        orders: calcTrend(totalOrders, prevOrders),
      },
      // Enhanced CRM stats
      customerSegments,
      bookingsByStatus,
      totalRevenue,
      broadcastsSent,
      avgRating,
      // Channel breakdown
      messagesByChannel,
      // Order statistics (for sales/shop businesses)
      totalOrders,
      ordersByStatus,
      orderRevenue,
      avgOrderValue,
      ordersByDay,
      popularProducts,
    });
  } catch (error) {
    console.error("Statistics error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
