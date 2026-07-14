/**
 * GET /api/telegram-business/diagnostic
 *
 * Возвращает состояние подключения TG Business для текущего бизнеса. Нужен
 * когда клиент говорит «подключил в Telegram, но статус не появился» — чтобы
 * не рыть логи, а увидеть на месте на каком именно шаге застряло.
 *
 * Показывает:
 *  - зарегистрирован ли webhook правильно (allowed_updates включает business_*)
 *  - установлен ли Business.ownerTelegramChatId (это /start от владельца)
 *  - есть ли последняя ошибка от TG (например «Bad Gateway» / «Forbidden»)
 *  - последний известный business_connection (если есть — значит хоть раз TG что-то прислал)
 *
 * НЕ раскрывает секреты (secret_token, botToken).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface TelegramWebhookInfo {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

const REQUIRED_BUSINESS_UPDATES = [
  "business_connection",
  "business_message",
  "edited_business_message",
  "deleted_business_messages",
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await prisma.business.findFirst({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      botToken: true,
      botUsername: true,
      ownerTelegramChatId: true,
      ownerTelegramUsername: true,
    },
  });

  if (!business) {
    return NextResponse.json({ error: "No business" }, { status: 404 });
  }

  const result: Record<string, unknown> = {
    business: {
      id: business.id,
      name: business.name,
      botUsername: business.botUsername,
      // ownerTelegramChatId должен быть установлен через /start от владельца
      hasOwnerTelegramChatId: !!business.ownerTelegramChatId,
      ownerTelegramChatId: business.ownerTelegramChatId?.toString() ?? null,
      ownerTelegramUsername: business.ownerTelegramUsername ?? null,
    },
  };

  // 1) Спрашиваем у Telegram текущий webhook state
  let webhookInfo: TelegramWebhookInfo | null = null;
  if (business.botToken) {
    // decrypt() — envelope encryption; passthrough для plaintext
    const { decrypt } = await import("@/lib/crypto");
    const token = decrypt(business.botToken) || business.botToken;
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${token}/getWebhookInfo`
      );
      const data = await r.json();
      if (data.ok) {
        webhookInfo = data.result as TelegramWebhookInfo;
      } else {
        result.webhookFetchError = data.description ?? "unknown";
      }
    } catch (e) {
      result.webhookFetchError = String(e);
    }
  } else {
    result.webhookFetchError = "no botToken configured";
  }

  if (webhookInfo) {
    const allowedUpdates = webhookInfo.allowed_updates ?? [];
    const missingBusinessUpdates = REQUIRED_BUSINESS_UPDATES.filter(
      (u) => !allowedUpdates.includes(u)
    );
    result.webhook = {
      url: webhookInfo.url,
      pendingUpdateCount: webhookInfo.pending_update_count,
      lastErrorDate: webhookInfo.last_error_date
        ? new Date(webhookInfo.last_error_date * 1000).toISOString()
        : null,
      lastErrorMessage: webhookInfo.last_error_message ?? null,
      allowedUpdates,
      // KEY MARKER: если тут не пусто — Шаг 2 в дашборде не сработал / не был нажат.
      // TG не будет присылать business_connection пока эти типы не в allowed_updates.
      missingBusinessUpdates,
      businessReady: missingBusinessUpdates.length === 0,
    };
  }

  // 2) Проверяем текущие подключения (multi-owner: их может быть несколько —
  //    владелец + сотрудники).
  const conns = await prisma.telegramBusinessConnection.findMany({
    where: { businessId: business.id },
    select: {
      id: true,
      connectionId: true,
      ownerUserId: true,
      canReply: true,
      isEnabled: true,
      pausedByOwner: true,
      connectedAt: true,
      lastEventAt: true,
      staffId: true,
      staff: { select: { name: true, role: true } },
    },
  });
  result.connections = conns.map((c) => ({
    id: c.id,
    connectionId: c.connectionId,
    connectedByUserId: c.ownerUserId.toString(),
    canReply: c.canReply,
    isEnabled: c.isEnabled,
    pausedByOwner: c.pausedByOwner,
    connectedAt: c.connectedAt.toISOString(),
    lastEventAt: c.lastEventAt?.toISOString() ?? null,
    role: c.staffId === null ? "owner" : "staff",
    staff: c.staff ?? null,
  }));

  // Для обратной совместимости с текущим UI — оставляем плоский connection
  // (первое найденное подключение владельца).
  const ownerConn = conns.find((c) => c.staffId === null);
  result.connection = ownerConn
    ? {
        exists: true,
        connectionId: ownerConn.connectionId,
        connectedByUserId: ownerConn.ownerUserId.toString(),
        canReply: ownerConn.canReply,
        isEnabled: ownerConn.isEnabled,
        pausedByOwner: ownerConn.pausedByOwner,
        connectedAt: ownerConn.connectedAt.toISOString(),
        lastEventAt: ownerConn.lastEventAt?.toISOString() ?? null,
        userIdMatchesOwner:
          business.ownerTelegramChatId?.toString() ===
          ownerConn.ownerUserId.toString(),
      }
    : { exists: false };

  // 3) Сводная диагностика — какие шаги пройдены / не пройдены
  const diagnosis: string[] = [];
  const webhookReady =
    typeof result.webhook === "object" &&
    result.webhook !== null &&
    (result.webhook as { businessReady?: boolean }).businessReady === true;
  if (!webhookReady) {
    diagnosis.push(
      "❌ Шаг 2 (кнопка «Подготовить бота») НЕ выполнен или не сработал — allowed_updates у Telegram не содержит business_*. Нажмите кнопку «Подготовить бота» ещё раз."
    );
  } else {
    diagnosis.push("✅ Шаг 2 выполнен — webhook подписан на business_* события.");
  }
  if (!business.ownerTelegramChatId && conns.length === 0) {
    diagnosis.push(
      "ℹ️ Владелец ещё ни разу не подключался. Первый подключившийся автоматически станет владельцем (auto-claim). Если это Ваш случай — просто подключите бота в Telegram Business с любого своего аккаунта, мы запомним."
    );
  } else if (business.ownerTelegramChatId) {
    diagnosis.push(
      "✅ Владелец делал /start или уже auto-claim — ownerTelegramChatId установлен."
    );
  }

  if (conns.length > 0) {
    const ownerConnNow = conns.find((c) => c.staffId === null);
    const staffConns = conns.filter((c) => c.staffId !== null);
    if (ownerConnNow) {
      diagnosis.push(
        `✅ Подключение владельца активно (user_id ${ownerConnNow.ownerUserId}, ${ownerConnNow.isEnabled ? "enabled" : "disabled"}, ${ownerConnNow.canReply ? "canReply" : "no reply right"}).`
      );
    }
    if (staffConns.length > 0) {
      diagnosis.push(
        `✅ Подключено сотрудников: ${staffConns.length}. Владелец может паузить каждого отдельно.`
      );
    }
  } else if (webhookReady) {
    diagnosis.push(
      "⏳ Всё готово со стороны Staffix, но business_connection от TG ещё не пришёл. Проверьте: (1) в @BotFather → Bot Settings → Secretary Mode → Turn on выполнено; (2) в Telegram → Settings → Telegram Business → Chatbots введено имя бота и нажат ADD; (3) обновите эту страницу через 1 минуту."
    );
  }
  result.diagnosis = diagnosis;

  return NextResponse.json(result);
}
