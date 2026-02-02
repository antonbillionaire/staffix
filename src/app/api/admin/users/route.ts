import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json(
        { error: "Доступ запрещён" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "all";
    const status = searchParams.get("status") || "all"; // active, expired, all

    const skip = (page - 1) * limit;

    // Build where clause
    const userWhere: Record<string, unknown> = {};
    if (search) {
      userWhere.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { businesses: { some: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    // Get users with their businesses and subscriptions
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          businesses: {
            include: {
              subscription: true,
              _count: {
                select: {
                  bookings: true,
                  conversations: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where: userWhere }),
    ]);

    // Filter by plan and status
    let filteredUsers = users.map((user) => {
      const business = user.businesses[0];
      const subscription = business?.subscription;
      const isExpired = subscription?.expiresAt
        ? new Date(subscription.expiresAt) < new Date()
        : true;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
        business: business
          ? {
              id: business.id,
              name: business.name,
              botActive: business.botActive,
              botUsername: business.botUsername,
              bookingsCount: business._count.bookings,
              conversationsCount: business._count.conversations,
            }
          : null,
        subscription: subscription
          ? {
              plan: subscription.plan,
              messagesUsed: subscription.messagesUsed,
              messagesLimit: subscription.messagesLimit,
              expiresAt: subscription.expiresAt,
              isExpired,
            }
          : null,
      };
    });

    // Apply plan filter
    if (plan !== "all") {
      filteredUsers = filteredUsers.filter(
        (u) => u.subscription?.plan === plan
      );
    }

    // Apply status filter
    if (status === "active") {
      filteredUsers = filteredUsers.filter(
        (u) => u.subscription && !u.subscription.isExpired
      );
    } else if (status === "expired") {
      filteredUsers = filteredUsers.filter(
        (u) => !u.subscription || u.subscription.isExpired
      );
    }

    return NextResponse.json({
      users: filteredUsers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
