/**
 * Telegram Bot API HTTP helpers + базовые типы.
 *
 * Тут только обёртки над fetch — никакой бизнес-логики, никаких prisma-вызовов.
 * Webhook handler и lib/telegram/* зовут эти функции для отправки сообщений.
 *
 * Поведение (важное при ревью):
 *  - sendTelegramMessage чистит markdown через stripMarkdown (Claude часто
 *    отдаёт **жирный** / ## заголовки, клиент в Telegram видит их как текст).
 *  - parse_mode НЕ передаётся в sendMessage — иначе спецсимволы в имени клиента
 *    могут сломать отправку (баг с notify_manager).
 *  - Сообщения >4096 символов автоматически режутся на куски по \n.
 */

import { stripMarkdown } from "@/lib/strip-markdown";
import { decrypt } from "@/lib/crypto";

/**
 * Централизованный decrypt для botToken. Callsite'ы этого модуля передают
 * значение из Business.botToken как есть; функция сама разбирается —
 * envelope encryption (`v1:...`) → расшифровка, plaintext → passthrough.
 */
function resolveBotToken(botToken: string): string {
  return decrypt(botToken) || botToken;
}

// Внутренний тип "обычного" Message от Telegram. Используется и для
// update.message, и для update.business_message — структура одинаковая, отличается
// только наличие поля business_connection_id (заполнено только в business-варианте).
export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    is_bot?: boolean;
  };
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
  contact?: {
    phone_number: string;
    first_name: string;
    last_name?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  voice?: {
    file_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  audio?: {
    file_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  // Заполнено только для message из business-чата. Это якорь для send: чтобы
  // ответить от имени владельца, мы передаём этот id обратно в sendMessage.
  business_connection_id?: string;
  // Бот, который реально отправил сообщение от имени владельца (для исходящих).
  // Нужно для loop prevention — мы игнорируем business_message где
  // sender_business_bot.id == id нашего бота (это эхо нашего же ответа).
  sender_business_bot?: {
    id: number;
    is_bot: boolean;
    username?: string;
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  // Новые типы апдейтов из Telegram Business API. Доки:
  // https://core.telegram.org/bots/api#update
  business_connection?: {
    id: string;            // BusinessConnection.id
    user: {                // владелец, у кого работает бот
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    user_chat_id: number;  // личный chat_id с владельцем, для системных сообщений
    date: number;
    can_reply: boolean;    // право отвечать (может быть false)
    is_enabled: boolean;   // подключение активно или владелец поставил паузу
  };
  business_message?: TelegramMessage;
  edited_business_message?: TelegramMessage;
  deleted_business_messages?: {
    business_connection_id: string;
    chat_id: number;
    message_ids: number[];
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data?: string;
  };
}

export function splitTelegramMessage(text: string, maxLen = 4096): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.3) splitAt = maxLen; // нет хорошего \n до лимита
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  // Опциональный business_connection_id — если передан, сообщение уйдёт
  // ОТ ИМЕНИ ВЛАДЕЛЬЦА в его личный чат (Telegram Business API). Клиент
  // в чате увидит ответ как сообщение от самого владельца, а не от бота.
  // Если не передан — обычная отправка от бота (старое поведение).
  businessConnectionId?: string
): Promise<boolean> {
  try {
    const token = resolveBotToken(botToken);
    const cleanText = stripMarkdown(text);
    if (!cleanText) return true;

    const chunks = cleanText.length > 4096 ? splitTelegramMessage(cleanText) : [cleanText];
    let ok = true;
    for (const chunk of chunks) {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {}),
          }),
        }
      );
      if (!response.ok) ok = false;
    }
    return ok;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

export async function sendTelegramPhoto(
  botToken: string,
  chatId: number,
  photoUrl: string,
  caption?: string
): Promise<boolean> {
  try {
    const token = resolveBotToken(botToken);
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: caption ? caption.slice(0, 1024) : undefined,
          parse_mode: caption ? "HTML" : undefined,
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Error sending Telegram photo:", error);
    return false;
  }
}

export async function sendTelegramMessageWithButtons(
  botToken: string,
  chatId: number,
  text: string,
  buttons: { text: string; url: string }[][]
): Promise<boolean> {
  try {
    const token = resolveBotToken(botToken);
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: buttons },
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Error sending Telegram message with buttons:", error);
    return false;
  }
}

export async function sendTypingAction(
  botToken: string,
  chatId: number
): Promise<void> {
  try {
    const token = resolveBotToken(botToken);
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        action: "typing",
      }),
    });
  } catch {
    // Ignore
  }
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    const token = resolveBotToken(botToken);
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || "",
      }),
    });
  } catch {
    // Ignore
  }
}

export async function editMessageText(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string
): Promise<void> {
  try {
    const token = resolveBotToken(botToken);
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch {
    // Ignore
  }
}
