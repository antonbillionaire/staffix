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
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${business.botToken}/getWebhookInfo`
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

  // 2) Проверяем текущее подключение (если есть в БД)
  const conn = await prisma.telegramBusinessConnection.findUnique({
    where: { businessId: business.id },
    select: {
      connectionId: true,
      ownerUserId: true,
      canReply: true,
      isEnabled: true,
      pausedByOwner: true,
      connectedAt: true,
      lastEventAt: true,
    },
  });
  result.connection = conn
    ? {
        exists: true,
        connectionId: conn.connectionId,
        // ID аккаунта который подключил бота через Telegram Business
        connectedByUserId: conn.ownerUserId.toString(),
        canReply: conn.canReply,
        isEnabled: conn.isEnabled,
        pausedByOwner: conn.pausedByOwner,
        connectedAt: conn.connectedAt.toISOString(),
        lastEventAt: conn.lastEventAt?.toISOString() ?? null,
        // MATCH CHECK: если этот id ≠ ownerTelegramChatId, значит владелец
        // сделал /start с одного аккаунта, а Telegram Business подключил с
        // другого. TG будет присылать нам события, но handler откажется
        // связывать connection с бизнесом.
        userIdMatchesOwner:
          business.ownerTelegramChatId?.toString() ===
          conn.ownerUserId.toString(),
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
  if (!business.ownerTelegramChatId) {
    diagnosis.push(
      "❌ Владелец не сделал /start в боте — Business.ownerTelegramChatId пустой. Владелец должен запустить /start в своём боте с того же аккаунта, с которого будет подключать Telegram Business."
    );
  } else {
    diagnosis.push(
      "✅ Владелец делал /start — ownerTelegramChatId установлен."
    );
  }
  if (conn) {
    const owns =
      business.ownerTelegramChatId?.toString() === conn.ownerUserId.toString();
    if (owns) {
      diagnosis.push("✅ TG прислал business_connection и он привязан к бизнесу.");
    } else {
      diagnosis.push(
        `⚠️ TG прислал business_connection от аккаунта ${conn.ownerUserId} — но /start был с другого аккаунта (${business.ownerTelegramChatId}). Владелец должен подключать Telegram Business с ТОГО ЖЕ аккаунта, с которого делал /start.`
      );
    }
  } else if (
    webhookReady &&
    business.ownerTelegramChatId
  ) {
    diagnosis.push(
      "⏳ Всё готово, но business_connection от TG ещё не пришёл. Проверьте что в BotFather включён Secretary Mode и что бот действительно добавлен в Telegram → Settings → Telegram Business → Chatbots."
    );
  }
  result.diagnosis = diagnosis;

  return NextResponse.json(result);
}
