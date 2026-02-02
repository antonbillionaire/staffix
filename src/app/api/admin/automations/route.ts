import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

// Automation triggers and actions configuration
export const TRIGGER_TYPES = {
  trial_expiring: {
    id: "trial_expiring",
    name: "Триал истекает",
    description: "Срабатывает когда до истечения триала остаётся N дней",
    params: ["days_before"],
  },
  trial_expired: {
    id: "trial_expired",
    name: "Триал истёк",
    description: "Срабатывает когда триал истёк",
    params: [],
  },
  subscription_expiring: {
    id: "subscription_expiring",
    name: "Подписка истекает",
    description: "Срабатывает когда до истечения подписки остаётся N дней",
    params: ["days_before"],
  },
  messages_low: {
    id: "messages_low",
    name: "Мало сообщений",
    description: "Срабатывает когда осталось менее N% сообщений",
    params: ["percentage"],
  },
  user_inactive: {
    id: "user_inactive",
    name: "Неактивный пользователь",
    description: "Пользователь не заходил N дней",
    params: ["days_inactive"],
  },
  new_signup: {
    id: "new_signup",
    name: "Новая регистрация",
    description: "Срабатывает при новой регистрации",
    params: [],
  },
  booking_created: {
    id: "booking_created",
    name: "Новая запись",
    description: "Клиент создал запись через бота",
    params: [],
  },
} as const;

export const ACTION_TYPES = {
  send_email: {
    id: "send_email",
    name: "Отправить email",
    description: "Отправить email пользователю",
    params: ["subject", "template"],
  },
  send_telegram: {
    id: "send_telegram",
    name: "Telegram уведомление",
    description: "Отправить сообщение в Telegram",
    params: ["message"],
  },
  extend_trial: {
    id: "extend_trial",
    name: "Продлить триал",
    description: "Автоматически продлить триал",
    params: ["days"],
  },
  add_messages: {
    id: "add_messages",
    name: "Добавить сообщения",
    description: "Добавить сообщения к лимиту",
    params: ["count"],
  },
  notify_admin: {
    id: "notify_admin",
    name: "Уведомить админа",
    description: "Отправить уведомление администратору",
    params: ["message"],
  },
  add_tag: {
    id: "add_tag",
    name: "Добавить тег",
    description: "Добавить тег к пользователю",
    params: ["tag"],
  },
} as const;

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    // Get all automations
    const automations = await prisma.adminAutomation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });

    // Get execution stats
    const stats = await prisma.automationExecution.groupBy({
      by: ["automationId"],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    const statsMap = new Map(stats.map((s) => [s.automationId, s._count]));

    return NextResponse.json({
      automations: automations.map((a) => ({
        ...a,
        executionsLast30Days: statsMap.get(a.id) || 0,
      })),
      triggers: TRIGGER_TYPES,
      actions: ACTION_TYPES,
    });
  } catch (error) {
    console.error("Admin automations error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, trigger, triggerParams, action, actionParams, isActive } = body;

    if (!name || !trigger || !action) {
      return NextResponse.json(
        { error: "Заполните обязательные поля" },
        { status: 400 }
      );
    }

    const automation = await prisma.adminAutomation.create({
      data: {
        name,
        description: description || "",
        trigger,
        triggerParams: triggerParams || {},
        action,
        actionParams: actionParams || {},
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ automation });
  } catch (error) {
    console.error("Create automation error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
