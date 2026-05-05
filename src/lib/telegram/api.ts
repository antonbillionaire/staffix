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

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
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
  text: string
): Promise<boolean> {
  try {
    const cleanText = stripMarkdown(text);
    if (!cleanText) return true;

    const chunks = cleanText.length > 4096 ? splitTelegramMessage(cleanText) : [cleanText];
    let ok = true;
    for (const chunk of chunks) {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
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
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
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
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
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
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
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
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
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
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
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
