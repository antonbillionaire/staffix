import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json(
        { error: "Доступ запрещён" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        businesses: {
          include: {
            subscription: true,
            services: true,
            staff: true,
            bookings: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            conversations: {
              orderBy: { updatedAt: "desc" },
              take: 10,
              include: {
                messages: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
                _count: {
                  select: { messages: true },
                },
              },
            },
            _count: {
              select: {
                bookings: true,
                conversations: true,
                services: true,
                staff: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const business = user.businesses[0];
    const subscription = business?.subscription;

    // Calculate subscription stats
    const isExpired = subscription?.expiresAt
      ? new Date(subscription.expiresAt) < new Date()
      : true;

    const daysLeft = subscription?.expiresAt
      ? Math.ceil(
          (new Date(subscription.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : 0;

    // Get activity timeline
    const recentBookings = business?.bookings.map((b) => ({
      id: b.id,
      type: "booking" as const,
      date: b.createdAt,
      description: `Запись на ${new Date(b.date).toLocaleDateString("ru-RU")}`,
      status: b.status,
    })) || [];

    const recentConversations = business?.conversations.map((c) => ({
      id: c.id,
      type: "conversation" as const,
      date: c.updatedAt,
      description: c.messages[0]?.content?.substring(0, 100) || "Новый диалог",
      messagesCount: c._count?.messages || 0,
    })) || [];

    // Merge and sort timeline
    const timeline = [...recentBookings, ...recentConversations]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
      },
      business: business
        ? {
            id: business.id,
            name: business.name,
            description: business.description,
            phone: business.phone,
            address: business.address,
            botActive: business.botActive,
            botToken: business.botToken ? "***" : null,
            botUsername: business.botUsername,
            onboardingCompleted: business.onboardingCompleted,
            createdAt: business.createdAt,
            counts: business._count,
            services: business.services.map((s) => ({
              id: s.id,
              name: s.name,
              price: s.price,
              duration: s.duration,
            })),
            staff: business.staff.map((s) => ({
              id: s.id,
              name: s.name,
              role: s.role,
            })),
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            plan: subscription.plan,
            messagesUsed: subscription.messagesUsed,
            messagesLimit: subscription.messagesLimit,
            expiresAt: subscription.expiresAt,
            createdAt: subscription.createdAt,
            isExpired,
            daysLeft,
          }
        : null,
      timeline,
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

// Update user subscription or details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json(
        { error: "Доступ запрещён" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, data } = body;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        businesses: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const business = user.businesses[0];

    switch (action) {
      case "extend_trial": {
        if (!business?.subscription) {
          return NextResponse.json(
            { error: "Подписка не найдена" },
            { status: 400 }
          );
        }
        const days = data?.days || 7;
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + days);

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: { expiresAt: newExpiry },
        });

        return NextResponse.json({ success: true, message: `Триал продлён на ${days} дней` });
      }

      case "upgrade_plan": {
        if (!business?.subscription) {
          return NextResponse.json(
            { error: "Подписка не найдена" },
            { status: 400 }
          );
        }
        const { plan, messagesLimit } = data;
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: {
            plan,
            messagesLimit: messagesLimit || (plan === "pro" ? 2000 : 10000),
            expiresAt,
          },
        });

        return NextResponse.json({ success: true, message: `План изменён на ${plan}` });
      }

      case "add_messages": {
        if (!business?.subscription) {
          return NextResponse.json(
            { error: "Подписка не найдена" },
            { status: 400 }
          );
        }
        const messages = data?.messages || 100;

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: {
            messagesLimit: { increment: messages },
          },
        });

        return NextResponse.json({ success: true, message: `Добавлено ${messages} сообщений` });
      }

      case "reset_messages": {
        if (!business?.subscription) {
          return NextResponse.json(
            { error: "Подписка не найдена" },
            { status: 400 }
          );
        }

        await prisma.subscription.update({
          where: { id: business.subscription.id },
          data: { messagesUsed: 0 },
        });

        return NextResponse.json({ success: true, message: "Счётчик сообщений сброшен" });
      }

      default:
        return NextResponse.json(
          { error: "Неизвестное действие" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Admin user update error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
