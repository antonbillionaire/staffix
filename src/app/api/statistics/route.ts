import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

    // Get total messages
    const totalMessages = await prisma.message.count({
      where: {
        conversation: { businessId: business.id },
        createdAt: { gte: startDate },
      },
    });

    // Get total bookings
    const totalBookings = await prisma.booking.count({
      where: {
        businessId: business.id,
        createdAt: { gte: startDate },
      },
    });

    // Get unique clients
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId: business.id,
        createdAt: { gte: startDate },
      },
      select: { clientTelegramId: true },
      distinct: ["clientTelegramId"],
    });
    const totalClients = conversations.length;

    // Calculate conversion rate
    const conversionRate = totalClients > 0
      ? Math.round((totalBookings / totalClients) * 100)
      : 0;

    // Get messages by day
    const messages = await prisma.message.findMany({
      where: {
        conversation: { businessId: business.id },
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by day
    const messagesByDayMap = new Map<string, number>();
    messages.forEach((msg) => {
      const dateStr = msg.createdAt.toISOString().split("T")[0];
      messagesByDayMap.set(dateStr, (messagesByDayMap.get(dateStr) || 0) + 1);
    });

    // Show appropriate number of days based on period
    const maxDays = period === "week" ? 7 : period === "month" ? 30 : 90;
    const messagesByDay = Array.from(messagesByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .slice(-maxDays);

    // Get popular questions (messages from users)
    const userMessages = await prisma.message.findMany({
      where: {
        conversation: { businessId: business.id },
        role: "user",
        createdAt: { gte: startDate },
      },
      select: { content: true },
    });

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

    // Enhanced CRM stats
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Customer segments
    const clients = await prisma.client.findMany({
      where: { businessId: business.id },
      select: { totalVisits: true, lastVisitDate: true },
    });

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
    const bookingStatusCounts = await prisma.booking.groupBy({
      by: ["status"],
      where: { businessId: business.id, createdAt: { gte: startDate } },
      _count: true,
    });

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
    const completedBookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        status: "completed",
        createdAt: { gte: startDate },
      },
      include: { service: { select: { price: true } } },
    });
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);

    // Broadcasts sent
    const broadcastsSent = await prisma.clientBroadcast.count({
      where: {
        businessId: business.id,
        status: "sent",
        createdAt: { gte: startDate },
      },
    });

    // Average rating
    const reviews = await prisma.review.findMany({
      where: { businessId: business.id, createdAt: { gte: startDate } },
      select: { rating: true },
    });
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    // Calculate trends by comparing to previous period
    const prevMessages = period !== "all" ? await prisma.message.count({
      where: {
        conversation: { businessId: business.id },
        createdAt: { gte: prevStartDate, lt: startDate },
      },
    }) : 0;

    const prevBookings = period !== "all" ? await prisma.booking.count({
      where: {
        businessId: business.id,
        createdAt: { gte: prevStartDate, lt: startDate },
      },
    }) : 0;

    const prevConversations = period !== "all" ? await prisma.conversation.findMany({
      where: {
        businessId: business.id,
        createdAt: { gte: prevStartDate, lt: startDate },
      },
      select: { clientTelegramId: true },
      distinct: ["clientTelegramId"],
    }) : [];

    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Calculate average response time from message pairs
    const recentConversations = await prisma.conversation.findMany({
      where: { businessId: business.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100,
          where: { createdAt: { gte: startDate } },
        },
      },
      take: 20,
    });

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

    return NextResponse.json({
      totalMessages,
      totalBookings,
      totalClients: clients.length || totalClients,
      avgResponseTime,
      conversionRate,
      popularQuestions,
      messagesByDay,
      // Trends
      trends: {
        messages: calcTrend(totalMessages, prevMessages),
        bookings: calcTrend(totalBookings, prevBookings),
        clients: calcTrend(totalClients, prevConversations.length),
      },
      // Enhanced CRM stats
      customerSegments,
      bookingsByStatus,
      totalRevenue,
      broadcastsSent,
      avgRating,
    });
  } catch (error) {
    console.error("Statistics error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
