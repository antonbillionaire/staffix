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

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
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

    const messagesByDay = Array.from(messagesByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .slice(-7); // Last 7 days

    // Get popular questions (messages from users)
    const userMessages = await prisma.message.findMany({
      where: {
        conversation: { businessId: business.id },
        role: "user",
        createdAt: { gte: startDate },
      },
      select: { content: true },
    });

    // Simple frequency analysis
    const questionCounts = new Map<string, number>();
    userMessages.forEach((msg) => {
      // Get first 50 chars as the "question"
      const question = msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : "");
      questionCounts.set(question, (questionCounts.get(question) || 0) + 1);
    });

    const popularQuestions = Array.from(questionCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      totalMessages,
      totalBookings,
      totalClients,
      avgResponseTime: 2, // Placeholder - would need actual timing data
      conversionRate,
      popularQuestions,
      messagesByDay,
    });
  } catch (error) {
    console.error("Statistics error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
