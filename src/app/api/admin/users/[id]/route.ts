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
            channelConversations: {
              orderBy: { updatedAt: "desc" },
              take: 10,
              select: {
                id: true,
                channel: true,
                clientName: true,
                updatedAt: true,
                messageCount: true,
                history: true,
              },
            },
            _count: {
              select: {
                bookings: true,
                conversations: true,
                channelConversations: true,
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
      channel: "telegram" as const,
      date: c.updatedAt,
      description: c.messages[0]?.content?.substring(0, 100) || "Новый диалог",
      messagesCount: c._count?.messages || 0,
    })) || [];

    // Sprint 4B: подтягиваем ChannelConversation (WA/IG/FB) в timeline тоже.
    // Раньше карточка админа показывала только TG-диалоги — для WA-only
    // бизнесов лента была пустой при реальных сотнях сообщений.
    // history-JSON хранит последнюю реплику, вытаскиваем её как description.
    interface HistoryEntry { role?: string; content?: string }
    const recentChannelConversations = business?.channelConversations.map((c) => {
      const hist = Array.isArray(c.history) ? (c.history as unknown as HistoryEntry[]) : [];
      const lastMsg = hist[hist.length - 1];
      return {
        id: c.id,
        type: "conversation" as const,
        channel: c.channel,
        date: c.updatedAt,
        description: (lastMsg?.content || "").substring(0, 100) || `Диалог (${c.channel})`,
        messagesCount: c.messageCount || 0,
      };
    }) || [];

    // Merge and sort timeline — TG + channel + bookings
    const timeline = [...recentBookings, ...recentConversations, ...recentChannelConversations]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // Sprint 4B: суммарный счётчик диалогов — TG + все канальные.
    // Раньше показывали только TG (business._count.conversations), из-за чего
    // карточка RIGHT FLIGHT показывала «3 диалога» при реальных 1984.
    const totalDialogs = business
      ? (business._count.conversations || 0) + (business._count.channelConversations || 0)
      : 0;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
        isBlocked: user.isBlocked,
        blockedReason: user.blockedReason,
        blockedAt: user.blockedAt,
      },
      business: business
        ? {
            id: business.id,
            name: business.name,
            phone: business.phone,
            address: business.address,
            botActive: business.botActive,
            botToken: business.botToken ? "***" : null,
            botUsername: business.botUsername,
            onboardingCompleted: business.onboardingCompleted,
            dashboardMode: business.dashboardMode,
            createdAt: business.createdAt,
            // Sprint 4B: dialogs теперь включают все каналы (TG + WA/IG/FB).
            counts: {
              ...business._count,
              dialogs: totalDialogs,
              conversationsChannel: business._count.channelConversations || 0,
              conversationsTelegram: business._count.conversations || 0,
            },
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

      case "reset_onboarding": {
        if (!business) {
          return NextResponse.json(
            { error: "Бизнес не найден" },
            { status: 400 }
          );
        }

        await prisma.business.update({
          where: { id: business.id },
          data: {
            onboardingCompleted: false,
            businessType: null,
            businessTypes: [],
          },
        });

        return NextResponse.json({ success: true, message: "Онбординг сброшен — пользователь пройдёт его заново" });
      }

      case "verify_email": {
        await prisma.user.update({
          where: { id },
          data: {
            emailVerified: true,
            verificationToken: null,
            verificationExpires: null,
          },
        });
        return NextResponse.json({ success: true, message: "Email подтверждён вручную" });
      }

      case "set_dashboard_mode": {
        if (!business) {
          return NextResponse.json({ error: "Бизнес не найден" }, { status: 400 });
        }
        const mode = data?.mode;
        if (mode !== "service" && mode !== "sales") {
          return NextResponse.json({ error: "mode must be 'service' or 'sales'" }, { status: 400 });
        }
        await prisma.business.update({
          where: { id: business.id },
          data: { dashboardMode: mode },
        });
        return NextResponse.json({
          success: true,
          message: `Режим дашборда переключён на «${mode === "sales" ? "Продажи" : "Услуги"}»`,
        });
      }

      case "block_user": {
        const reason = (data?.reason as string | undefined)?.trim() || null;
        await prisma.user.update({
          where: { id },
          data: {
            isBlocked: true,
            blockedReason: reason,
            blockedAt: new Date(),
          },
        });
        return NextResponse.json({
          success: true,
          message: "Пользователь заблокирован — логин и бот отключены",
        });
      }

      case "unblock_user": {
        await prisma.user.update({
          where: { id },
          data: {
            isBlocked: false,
            blockedReason: null,
            blockedAt: null,
          },
        });
        return NextResponse.json({
          success: true,
          message: "Пользователь разблокирован",
        });
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

// Полное удаление юзера — необратимое. Удаляет аккаунт, бизнес и весь
// связанный контент через cascade в Prisma. Использовать только для
// подтверждённого спама/абуза; для подозрительной активности лучше
// block_user (обратимо, аудиторский след сохраняется).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Защита от случайного удаления собственного админ-аккаунта
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Нельзя удалить свой собственный аккаунт" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    // Cascade в Prisma чистит Business и всё под ним
    // (Subscription, Conversations, Clients, и т.д. — onDelete: Cascade).
    await prisma.user.delete({ where: { id } });

    console.log(`[Admin] User deleted: ${user.email} (${user.id}) by ${session.user.email}`);

    return NextResponse.json({
      success: true,
      message: `Пользователь ${user.email} удалён полностью`,
    });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json(
      { error: "Ошибка удаления пользователя" },
      { status: 500 }
    );
  }
}
