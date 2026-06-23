/**
 * Telegram Business API handlers.
 *
 * Когда владелец в TG → Settings → Telegram Business → Chatbots добавляет
 * нашего бота к своему аккаунту, мы начинаем получать дополнительные типы
 * апдейтов на тот же webhook:
 *
 *   business_connection         — установка/изменение/отключение подключения
 *   business_message            — клиент написал в личный чат владельца
 *   edited_business_message     — кто-то отредактировал сообщение в этом чате
 *   deleted_business_messages   — сообщения удалили
 *
 * MVP-объём (этот файл):
 *  - business_connection: upsert TelegramBusinessConnection + уведомление владельцу.
 *  - business_message:    проверка прав (can_reply / is_enabled / pausedByOwner),
 *                         loop-prevention, передача в generateAIResponse,
 *                         отправка ответа клиенту от имени владельца.
 *  - edited/deleted:      только лог (MVP); пользовательский UX можно вернуть позже.
 *
 * Документация: https://core.telegram.org/bots/api#businessconnection
 * Требование на стороне владельца: активная Telegram Premium подписка
 * (фича Telegram Business входит в Premium). На нашей стороне это никак не
 * гейтится — Telegram просто не отдаёт update, если у владельца нет Premium.
 */

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage, TelegramMessage } from "@/lib/telegram/api";
import { generateAIResponse } from "@/lib/telegram/ai";
import { checkSubscriptionLimit, incrementMessageCount } from "@/lib/subscription-check";

interface BusinessConnectionUpdate {
  id: string;
  user: { id: number; first_name: string; last_name?: string; username?: string };
  user_chat_id: number;
  date: number;
  can_reply: boolean;
  is_enabled: boolean;
}

interface DeletedBusinessMessages {
  business_connection_id: string;
  chat_id: number;
  message_ids: number[];
}

/**
 * Обработка update.business_connection: владелец только что подключил/изменил/
 * отключил нашего бота к своему личному аккаунту. Привязываем connection_id
 * к Business по совпадению user.id ↔ Business.ownerTelegramChatId.
 *
 * Если совпадения нет — это значит владелец не подключал @-бота к своему
 * чату через /start, мы не знаем какой бизнес ему принадлежит. В этом случае
 * молча игнорируем и просим его сначала запустить /start.
 */
export async function handleBusinessConnection(
  botToken: string,
  conn: BusinessConnectionUpdate
): Promise<void> {
  const ownerUserId = BigInt(conn.user.id);
  const ownerChatId = BigInt(conn.user_chat_id);

  // Находим бизнес по совпадению owner Telegram id. Раньше владелец должен
  // был запустить /start в нашем боте — там мы сохранили его ownerTelegramChatId.
  const business = await prisma.business.findFirst({
    where: { ownerTelegramChatId: ownerUserId, botToken },
    select: { id: true, name: true },
  });

  if (!business) {
    console.warn(
      `[TG Business] connection from user_id=${ownerUserId} but no Business matches ownerTelegramChatId. Asking owner to /start.`
    );
    await sendTelegramMessage(
      botToken,
      conn.user_chat_id,
      "Чтобы я начал работать в ваших личных чатах, сначала запустите команду /start в этом боте — так я узнаю вас как владельца бизнеса."
    );
    return;
  }

  // Сценарий отключения: TG прислал is_enabled=false. Сохраняем для аудита,
  // но больше ничего делать не надо — webhook просто перестанет получать
  // business_message от этого connection.
  await prisma.telegramBusinessConnection.upsert({
    where: { connectionId: conn.id },
    create: {
      connectionId: conn.id,
      ownerUserId,
      ownerChatId,
      canReply: conn.can_reply,
      isEnabled: conn.is_enabled,
      businessId: business.id,
      lastEventAt: new Date(conn.date * 1000),
    },
    update: {
      canReply: conn.can_reply,
      isEnabled: conn.is_enabled,
      ownerChatId,
      lastEventAt: new Date(conn.date * 1000),
    },
  });

  // Уведомление владельцу в его @-боте: коротко, без эмодзи-парада.
  const status = !conn.is_enabled
    ? "Подключение AI к личным чатам отключено."
    : !conn.can_reply
      ? "AI подключён к личным чатам, но без права отвечать. Чтобы я мог отвечать клиентам, в настройках Telegram Business → Chatbots отметьте «Бот может отправлять сообщения»."
      : `AI подключён к вашим личным чатам ✓\n\nКлиенты, написавшие в личку, теперь получат ответ от AI-помощника бизнеса «${business.name}». Чтобы выбрать в каких чатах AI работает (с контактами, без, и т.д.), используйте настройки самого Telegram → Business → Chatbots.\n\nЧтобы временно поставить на паузу — зайдите в дашборд Staffix.`;

  await sendTelegramMessage(botToken, conn.user_chat_id, status);
  console.log(
    `[TG Business] connection ${conn.id} updated for business=${business.id}, is_enabled=${conn.is_enabled}, can_reply=${conn.can_reply}`
  );
}

/**
 * Обработка update.business_message: клиент написал в личный чат владельца.
 * AI пропускает сообщение и отвечает от имени владельца.
 */
export async function handleBusinessMessage(
  botToken: string,
  msg: TelegramMessage
): Promise<void> {
  const connectionId = msg.business_connection_id;
  if (!connectionId) return; // защита, не должно случаться

  // Loop prevention: если sender_business_bot указывает на нас — это наше
  // же сообщение, не отвечаем. Telegram прислал нам эхо, чтобы мы знали
  // что владелец видит исходящие в своём приложении.
  if (msg.sender_business_bot?.is_bot) {
    return;
  }

  const connection = await prisma.telegramBusinessConnection.findUnique({
    where: { connectionId },
    select: {
      businessId: true,
      canReply: true,
      isEnabled: true,
      pausedByOwner: true,
      ownerUserId: true,
    },
  });
  if (!connection) {
    console.warn(`[TG Business] message for unknown connection ${connectionId}, ignoring`);
    return;
  }

  // Не отвечаем если: отключено в TG, нет права отвечать, владелец нажал паузу
  if (!connection.isEnabled || !connection.canReply || connection.pausedByOwner) {
    console.log(
      `[TG Business] skip biz=${connection.businessId}: enabled=${connection.isEnabled}, canReply=${connection.canReply}, paused=${connection.pausedByOwner}`
    );
    return;
  }

  // Не отвечаем самому владельцу (он пишет в своих же чатах с клиентами руками)
  if (BigInt(msg.from.id) === connection.ownerUserId) {
    return;
  }

  // Гейт по подписке — те же лимиты что и для основного бота
  const { allowed } = await checkSubscriptionLimit(connection.businessId);
  if (!allowed) {
    console.log(`[TG Business] subscription limit reached for biz=${connection.businessId}, skipping`);
    return;
  }

  const userMessage = msg.text || "";
  if (!userMessage.trim()) {
    // Картинка/стикер/файл от клиента в личке владельца — молча игнорируем.
    // НЕ отвечаем «не могу обработать», потому что владелец может видеть это
    // в своём приложении и решит сам как реагировать.
    return;
  }

  const telegramId = BigInt(msg.from.id);
  const userName =
    msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");
  const telegramUsername = msg.from.username || null;

  try {
    const aiResult = await generateAIResponse(
      connection.businessId,
      telegramId,
      userMessage,
      userName,
      telegramUsername
    );

    const reply = aiResult?.text?.trim();
    if (!reply) {
      console.warn(`[TG Business] AI returned empty for biz=${connection.businessId}`);
      return;
    }

    // КРИТИЧНО: передаём connectionId третьим аргументом — это превращает
    // обычный sendMessage в отправку «от имени владельца» в личный чат.
    await sendTelegramMessage(botToken, msg.chat.id, reply, connectionId);
    await incrementMessageCount(connection.businessId);

    console.log(
      `[TG Business] replied for biz=${connection.businessId}, client=${telegramId}, len=${reply.length}`
    );
  } catch (e) {
    console.error(`[TG Business] AI flow failed for biz=${connection.businessId}:`, e);
  }
}

/**
 * Обработка edited_business_message — MVP: только лог.
 * В будущем можно обновлять последнее сообщение клиента в нашей истории.
 */
export function handleEditedBusinessMessage(msg: TelegramMessage): void {
  console.log(
    `[TG Business] edited message ${msg.message_id} in chat ${msg.chat.id} (connection ${msg.business_connection_id}) — no-op for MVP`
  );
}

/**
 * Обработка deleted_business_messages — MVP: только лог.
 */
export function handleDeletedBusinessMessages(deleted: DeletedBusinessMessages): void {
  console.log(
    `[TG Business] ${deleted.message_ids.length} message(s) deleted in chat ${deleted.chat_id} (connection ${deleted.business_connection_id}) — no-op for MVP`
  );
}
