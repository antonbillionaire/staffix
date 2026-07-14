/**
 * POST /api/admin/businesses/[id]/redeliver-escalations
 *
 * Берёт непрочитанные Notification типа manager_escalation у бизнеса
 * и отправляет их в Telegram владельцу (если ownerTelegramChatId настроен).
 *
 * Применение: исторические уведомления которые легли в дашборд но не дошли
 * в TG (потому что в момент их создания ownerTelegramChatId был NULL).
 * Теперь когда chatId есть — переотправляем.
 *
 * НЕ помечает Notification как прочитанные — это действие владельца.
 *
 * Параметры:
 *   POST body { limit?: number }   — максимум N (по умолчанию 20, max 100)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id: businessId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(body.limit ?? "20", 10), 1), 100);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, botToken: true, ownerTelegramChatId: true, timezone: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }
    if (!business.botToken) {
      return NextResponse.json({ error: "У бизнеса не подключён Telegram-бот" }, { status: 400 });
    }
    // decrypt() — envelope encryption; passthrough для plaintext
    if (business.botToken) {
      const { decrypt } = await import("@/lib/crypto");
      business.botToken = decrypt(business.botToken) || business.botToken;
    }

    if (!business.ownerTelegramChatId) {
      return NextResponse.json(
        {
          error:
            "Не куда отправлять — owner_telegram_chat_id не установлен. Сначала нажмите 'Тестовое уведомление' (там есть auto-fix) или попросите владельца сделать /start боту.",
        },
        { status: 400 }
      );
    }

    // Берём непрочитанные эскалации, начиная со старых — порядок имитирует
    // когда они должны были прийти.
    const unread = await prisma.notification.findMany({
      where: {
        businessId,
        type: "manager_escalation",
        isRead: false,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    if (unread.length === 0) {
      return NextResponse.json({
        delivered: 0,
        skipped: 0,
        failed: 0,
        message: "Непрочитанных эскалаций нет — доставлять нечего",
      });
    }

    let delivered = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const n of unread) {
      const meta = (n.metadata as { clientName?: string; urgency?: string } | null) || {};
      const isUrgent = meta.urgency === "urgent";
      const urgencyLabel = isUrgent ? "🚨 СРОЧНО" : "📩 Запрос";
      const dateStr = new Date(n.createdAt).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: business.timezone || "Asia/Tashkent",
      });

      const text =
        `${urgencyLabel} (отложенная доставка от ${dateStr})\n\n` +
        `${meta.clientName ? `👤 ${meta.clientName}\n` : ""}` +
        `Запрос: ${n.message}\n\n` +
        `Это уведомление лежало в дашборде непрочитанным — отправляем в Telegram сейчас.`;

      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${business.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: business.ownerTelegramChatId.toString(),
              text,
            }),
          }
        );

        if (tgRes.ok) {
          delivered++;
        } else {
          failed++;
          const errBody = await tgRes.text().catch(() => "");
          errors.push({
            id: n.id,
            error: `${tgRes.status}: ${errBody.slice(0, 200)}`,
          });
          // Если бот заблокирован — нет смысла продолжать, оставшиеся тоже не дойдут
          if (tgRes.status === 403) break;
        }
      } catch (e) {
        failed++;
        errors.push({
          id: n.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // Лёгкий throttle чтобы не упереться в Telegram limit (30 msg/sec)
      await new Promise((r) => setTimeout(r, 150));
    }

    return NextResponse.json({
      delivered,
      failed,
      skipped: 0,
      total: unread.length,
      errors: errors.length > 0 ? errors : undefined,
      message:
        failed === 0
          ? `Доставлено ${delivered} уведомлений в Telegram владельцу`
          : `Доставлено ${delivered}, не удалось ${failed}. См. errors.`,
    });
  } catch (error) {
    console.error("POST redeliver-escalations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}
