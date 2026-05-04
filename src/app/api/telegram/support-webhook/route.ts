import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSupportReplyToUserEmail } from "@/lib/email";
import {
  generateSupportReply,
  isEscalationResponse,
} from "@/lib/support-bot-prompt";

// Telegram update type — only fields we use
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
    audio?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
  };
}

// System prompt и AI-вызов вынесены в src/lib/support-bot-prompt.ts —
// общий модуль для Telegram-бота и виджета на дашборде.

// ---------------------------------------------------------------------------
// Telegram helpers
// ---------------------------------------------------------------------------

async function sendTelegramMessage(chatId: number | bigint, text: string): Promise<boolean> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  if (!botToken) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("[support-bot] sendTelegramMessage failed:", error);
    return false;
  }
}

async function sendTypingAction(chatId: number): Promise<void> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// DB persistence — replaces the old in-memory Map.
// ---------------------------------------------------------------------------

async function getOrCreateConversation(
  chatId: number,
  from: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string }
): Promise<{ id: string; messages: Array<{ role: string; content: string }> }> {
  const chatBig = BigInt(chatId);

  let conv = await prisma.supportBotConversation.findUnique({
    where: { telegramChatId: chatBig },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!conv) {
    conv = await prisma.supportBotConversation.create({
      data: {
        telegramChatId: chatBig,
        telegramUserId: BigInt(from.id),
        username: from.username || null,
        firstName: from.first_name,
        lastName: from.last_name || null,
        language: from.language_code || null,
      },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  }

  // Возвращаем хронологически — старые сначала
  const messagesAsc = conv.messages.slice().reverse().map((m) => ({ role: m.role, content: m.content }));
  return { id: conv.id, messages: messagesAsc };
}

async function appendMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<void> {
  await prisma.supportBotMessage.create({
    data: { conversationId, role, content },
  });
  await prisma.supportBotConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Admin reply (от админа в боте — /reply <ticketId> <message>)
// Сохраняет в БД, ОБНОВЛЯЕТ статус тикета, ШЛЁТ EMAIL пользователю.
// Это и было главным разрывом — раньше ответ висел только в БД.
// ---------------------------------------------------------------------------

async function handleAdminReply(
  ticketIdShort: string,
  replyMessage: string
): Promise<string> {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { id: { endsWith: ticketIdShort } },
      include: { user: { select: { email: true, name: true } } },
    });

    if (tickets.length === 0) {
      return `❌ Тикет с ID "${ticketIdShort}" не найден.`;
    }
    if (tickets.length > 1) {
      return `⚠️ Найдено несколько тикетов. Используйте полный ID.`;
    }

    const ticket = tickets[0];

    await prisma.supportMessage.create({
      data: {
        content: replyMessage,
        isFromSupport: true,
        ticketId: ticket.id,
      },
    });

    if (ticket.status === "open") {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "in_progress" },
      });
    }

    // 🔔 Уведомление пользователю — это и есть фикс главной баги.
    let emailStatus = "✉️ email не отправлен (нет адреса)";
    if (ticket.user.email) {
      try {
        const result = await sendSupportReplyToUserEmail({
          email: ticket.user.email,
          name: ticket.user.name || "пользователь",
          ticketSubject: ticket.subject,
          ticketIdShort,
          replyMessage,
        });
        emailStatus = result.success
          ? `✉️ email отправлен на ${ticket.user.email}`
          : `⚠️ email НЕ отправлен: ${result.error || "ошибка"}`;
      } catch (e) {
        emailStatus = `⚠️ email сбой: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    return `✅ Ответ отправлен!\n\n<b>Тикет:</b> ${ticketIdShort}\n<b>Клиент:</b> ${ticket.user.name || ticket.user.email}\n${emailStatus}\n\n<b>Ваш ответ:</b>\n${replyMessage}`;
  } catch (error) {
    console.error("[support-bot] handleAdminReply error:", error);
    return `❌ Ошибка при сохранении ответа. Попробуйте позже.`;
  }
}

// Notify admin about escalation (когда AI сам передаёт диалог человеку)
async function notifyAdminEscalation(
  userName: string,
  userMessage: string,
  chatId: number,
  conversationId: string
): Promise<void> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  const adminChatId = process.env.SUPPORT_CHAT_ID;
  if (!botToken || !adminChatId) return;

  const message =
    `🔔 <b>Эскалация из support-бота</b>\n\n` +
    `<b>Пользователь:</b> ${userName}\n` +
    `<b>Chat ID:</b> <code>${chatId}</code>\n` +
    `<b>Conversation ID:</b> <code>${conversationId.slice(-8)}</code>\n\n` +
    `<b>Сообщение:</b>\n${userMessage}\n\n` +
    `💬 Ответьте напрямую в <a href="https://t.me/staffix_support_bot">@staffix_support_bot</a> или через тикет /reply.`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.error("[support-bot] notifyAdminEscalation failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Webhook entrypoint
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    if (!update.message?.text && !update.message?.voice && !update.message?.audio) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    let userMessage = message.text || "";
    const userName = message.from.first_name + (message.from.last_name ? ` ${message.from.last_name}` : "");

    // Voice / audio → STT
    if (!userMessage && (message.voice || message.audio)) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      const botToken = process.env.SUPPORT_BOT_TOKEN;
      if (botToken && fileId) {
        try {
          const { downloadTelegramFile, transcribeAudio } = await import("@/lib/voice-ai");
          const buf = await downloadTelegramFile(botToken, fileId);
          const filename = message.voice ? "voice.ogg" : "audio.mp3";
          const result = await transcribeAudio(buf, filename);
          userMessage = (result.text || "").trim();
          console.log(`[support-bot] STT (${result.language || "?"}): "${userMessage.slice(0, 80)}"`);
        } catch (e) {
          console.error("[support-bot] STT failed:", e);
        }
      }
      if (!userMessage) {
        await sendTelegramMessage(
          chatId,
          "Извините, не удалось распознать голосовое сообщение. Пожалуйста, напишите Ваш вопрос текстом."
        );
        return NextResponse.json({ ok: true });
      }
    }

    // /start
    if (userMessage === "/start") {
      await sendTelegramMessage(
        chatId,
        `Здравствуйте, ${message.from.first_name}! 👋\n\n` +
          `Я AI-помощник службы поддержки Staffix.\n\n` +
          `Задайте вопрос о платформе, и я постараюсь помочь:\n` +
          `• Как настроить AI-сотрудника\n` +
          `• Как подключить Telegram / WhatsApp / Instagram / Facebook\n` +
          `• Вопросы о тарифах и оплате\n` +
          `• Технические проблемы\n\n` +
          `Просто напишите Ваш вопрос!`
      );
      return NextResponse.json({ ok: true });
    }

    if (userMessage === "/help") {
      await sendTelegramMessage(
        chatId,
        `<b>Чем я могу помочь:</b>\n\n` +
          `• Ответить на вопросы о Staffix\n` +
          `• Помочь с настройкой AI-сотрудника\n` +
          `• Объяснить как подключить мессенджеры\n` +
          `• Рассказать о тарифах\n\n` +
          `<b>Команды:</b>\n` +
          `/start — Начать сначала\n` +
          `/help — Эта справка\n` +
          `/human — Связаться с живым оператором`
      );
      return NextResponse.json({ ok: true });
    }

    if (userMessage === "/human") {
      const conv = await getOrCreateConversation(chatId, message.from);
      await notifyAdminEscalation(userName, "Пользователь запросил связь с оператором", chatId, conv.id);
      await sendTelegramMessage(
        chatId,
        `Ваш запрос передан нашему специалисту. Он свяжется с Вами в ближайшее время.\n\n` +
          `Пока ожидаете — можете задать другие вопросы, возможно я смогу помочь.`
      );
      return NextResponse.json({ ok: true });
    }

    // Admin commands — /reply, /tickets
    const adminChatId = process.env.SUPPORT_CHAT_ID;
    if (userMessage.startsWith("/reply ") && String(chatId) === adminChatId) {
      const parts = userMessage.slice(7).trim().split(" ");
      const ticketIdShort = parts[0];
      const replyMessage = parts.slice(1).join(" ");
      if (!ticketIdShort || !replyMessage) {
        await sendTelegramMessage(
          chatId,
          `❌ <b>Неверный формат</b>\n\nИспользуйте:\n<code>/reply TICKET_ID Ваш ответ</code>`
        );
        return NextResponse.json({ ok: true });
      }
      const result = await handleAdminReply(ticketIdShort, replyMessage);
      await sendTelegramMessage(chatId, result);
      return NextResponse.json({ ok: true });
    }

    if (userMessage === "/tickets" && String(chatId) === adminChatId) {
      try {
        const openTickets = await prisma.supportTicket.findMany({
          where: { status: { in: ["open", "in_progress"] } },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        if (openTickets.length === 0) {
          await sendTelegramMessage(chatId, "✅ Нет открытых тикетов!");
        } else {
          let msg = `📋 <b>Открытые тикеты (${openTickets.length}):</b>\n\n`;
          for (const t of openTickets) {
            const shortId = t.id.slice(-8);
            const status = t.status === "open" ? "🆕" : "⏳";
            msg += `${status} <code>${shortId}</code> — ${t.subject}\n   👤 ${t.user.name || t.user.email}\n\n`;
          }
          msg += `\n💬 Ответить: <code>/reply ID сообщение</code>`;
          await sendTelegramMessage(chatId, msg);
        }
      } catch (error) {
        console.error("[support-bot] /tickets error:", error);
        await sendTelegramMessage(chatId, "❌ Ошибка при загрузке тикетов");
      }
      return NextResponse.json({ ok: true });
    }

    // Регулярный диалог: персистентная история + AI ответ
    await sendTypingAction(chatId);

    const conv = await getOrCreateConversation(chatId, message.from);
    await appendMessage(conv.id, "user", userMessage);

    const history = conv.messages.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));
    const aiResponse = await generateSupportReply(history, userMessage);

    await appendMessage(conv.id, "assistant", aiResponse);
    await sendTelegramMessage(chatId, aiResponse);

    if (isEscalationResponse(aiResponse)) {
      await notifyAdminEscalation(userName, userMessage, chatId, conv.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[support-bot] webhook error:", error);
    return NextResponse.json({ ok: true }); // Telegram всегда ждёт 200
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", message: "Staffix Support Bot Webhook" });
}
