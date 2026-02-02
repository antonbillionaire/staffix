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
    const period = searchParams.get("period") || "30"; // days
    const periodDays = parseInt(period);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get user registrations by day
    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        createdAt: true,
        businesses: {
          select: {
            subscription: {
              select: {
                plan: true,
              },
            },
          },
        },
      },
    });

    // Group registrations by date
    const registrationsByDate: Record<string, number> = {};
    const registrationsByPlan: Record<string, number> = {
      trial: 0,
      pro: 0,
      business: 0,
      no_subscription: 0,
    };

    users.forEach((user) => {
      const dateKey = user.createdAt.toISOString().split("T")[0];
      registrationsByDate[dateKey] = (registrationsByDate[dateKey] || 0) + 1;

      const plan = user.businesses[0]?.subscription?.plan || "no_subscription";
      registrationsByPlan[plan] = (registrationsByPlan[plan] || 0) + 1;
    });

    // Get all subscriptions for revenue analysis
    const subscriptions = await prisma.subscription.findMany({
      include: {
        business: {
          select: {
            user: {
              select: {
                createdAt: true,
              },
            },
          },
        },
      },
    });

    // Calculate MRR history (simplified - based on current plans)
    const mrrByPlan = {
      trial: 0,
      pro: subscriptions.filter((s) => s.plan === "pro" && new Date(s.expiresAt) > new Date()).length * 50,
      business: subscriptions.filter((s) => s.plan === "business" && new Date(s.expiresAt) > new Date()).length * 100,
    };
    const totalMRR = mrrByPlan.pro + mrrByPlan.business;

    // Conversion funnel
    const totalUsers = await prisma.user.count();
    const usersWithBusiness = await prisma.user.count({
      where: {
        businesses: {
          some: {},
        },
      },
    });
    const usersWithBot = await prisma.business.count({
      where: {
        botActive: true,
      },
    });
    const paidUsers = subscriptions.filter(
      (s) => (s.plan === "pro" || s.plan === "business") && new Date(s.expiresAt) > new Date()
    ).length;

    // Messages usage
    const messagesUsed = subscriptions.reduce((sum, s) => sum + s.messagesUsed, 0);
    const messagesLimit = subscriptions.reduce((sum, s) => sum + s.messagesLimit, 0);

    // Bookings stats
    const bookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    const bookingsByDate: Record<string, number> = {};
    const bookingsByStatus: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
    };

    bookings.forEach((booking) => {
      const dateKey = booking.createdAt.toISOString().split("T")[0];
      bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;
      bookingsByStatus[booking.status] = (bookingsByStatus[booking.status] || 0) + 1;
    });

    // Conversations stats
    const conversations = await prisma.conversation.count({
      where: {
        createdAt: { gte: startDate },
      },
    });

    const messages = await prisma.message.count({
      where: {
        createdAt: { gte: startDate },
      },
    });

    // Churn calculation (expired subscriptions)
    const expiredTrials = subscriptions.filter(
      (s) => s.plan === "trial" && new Date(s.expiresAt) < new Date()
    ).length;
    const activeTrials = subscriptions.filter(
      (s) => s.plan === "trial" && new Date(s.expiresAt) >= new Date()
    ).length;

    // Top businesses by activity
    const topBusinesses = await prisma.business.findMany({
      take: 10,
      orderBy: {
        conversations: {
          _count: "desc",
        },
      },
      select: {
        id: true,
        name: true,
        botActive: true,
        _count: {
          select: {
            bookings: true,
            conversations: true,
          },
        },
        subscription: {
          select: {
            plan: true,
            messagesUsed: true,
          },
        },
      },
    });

    // Format chart data
    const chartData = {
      registrations: Object.entries(registrationsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      bookings: Object.entries(bookingsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
    };

    return NextResponse.json({
      period: periodDays,
      overview: {
        totalUsers,
        newUsers: users.length,
        totalMRR,
        mrrByPlan,
        messagesUsed,
        messagesLimit,
        messagesUtilization: messagesLimit > 0 ? Math.round((messagesUsed / messagesLimit) * 100) : 0,
      },
      funnel: {
        registered: totalUsers,
        withBusiness: usersWithBusiness,
        withBot: usersWithBot,
        paid: paidUsers,
        conversionRate: totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0,
      },
      subscriptions: {
        byPlan: registrationsByPlan,
        activeTrials,
        expiredTrials,
        churnRate: activeTrials + expiredTrials > 0
          ? Math.round((expiredTrials / (activeTrials + expiredTrials)) * 100)
          : 0,
      },
      activity: {
        totalBookings: bookings.length,
        bookingsByStatus,
        totalConversations: conversations,
        totalMessages: messages,
      },
      chartData,
      topBusinesses: topBusinesses.map((b) => ({
        id: b.id,
        name: b.name,
        plan: b.subscription?.plan || "none",
        botActive: b.botActive,
        bookings: b._count.bookings,
        conversations: b._count.conversations,
        messagesUsed: b.subscription?.messagesUsed || 0,
      })),
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
