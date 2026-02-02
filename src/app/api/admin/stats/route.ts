import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json(
        { error: "Доступ запрещён" },
        { status: 403 }
      );
    }

    // Get date ranges
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Parallel queries for stats
    const [
      totalUsers,
      totalBusinesses,
      activeSubscriptions,
      trialUsers,
      proUsers,
      businessUsers,
      newUsersToday,
      newUsersThisMonth,
      totalMessages,
      totalBookings,
      recentUsers,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Total businesses
      prisma.business.count(),

      // Active subscriptions (not expired)
      prisma.subscription.count({
        where: {
          expiresAt: { gte: new Date() },
        },
      }),

      // Trial users
      prisma.subscription.count({
        where: { plan: "trial" },
      }),

      // Pro users
      prisma.subscription.count({
        where: { plan: "pro" },
      }),

      // Business users
      prisma.subscription.count({
        where: { plan: "business" },
      }),

      // New users today
      prisma.user.count({
        where: {
          createdAt: { gte: startOfToday },
        },
      }),

      // New users this month
      prisma.user.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),

      // Total messages (from all conversations)
      prisma.message.count(),

      // Total bookings
      prisma.booking.count(),

      // Recent users (last 10)
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          businesses: {
            include: {
              subscription: true,
            },
          },
        },
      }),
    ]);

    // Calculate MRR (Monthly Recurring Revenue)
    const mrr = (proUsers * 50) + (businessUsers * 100);

    // Calculate conversion rate (trial to paid)
    const paidUsers = proUsers + businessUsers;
    const conversionRate = totalUsers > 0
      ? Math.round((paidUsers / totalUsers) * 100)
      : 0;

    return NextResponse.json({
      overview: {
        totalUsers,
        totalBusinesses,
        activeSubscriptions,
        mrr,
        conversionRate,
      },
      subscriptions: {
        trial: trialUsers,
        pro: proUsers,
        business: businessUsers,
      },
      activity: {
        newUsersToday,
        newUsersThisMonth,
        totalMessages,
        totalBookings,
      },
      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        businessName: user.businesses[0]?.name || null,
        plan: user.businesses[0]?.subscription?.plan || "no_subscription",
        expiresAt: user.businesses[0]?.subscription?.expiresAt || null,
      })),
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
