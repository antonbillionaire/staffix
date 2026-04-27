import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// Telegram types
interface TelegramUpdate {
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
  };
}

// Store conversation history (in production, use Redis or database)
const conversationHistory: Map<number, Array<{ role: "user" | "assistant"; content: string }>> = new Map();

// System prompt for support bot
const SYSTEM_PROMPT = `Ты — AI-помощник службы поддержки Staffix. Staffix — это SaaS платформа для создания AI-сотрудников для бизнеса.

Твоя задача — помогать пользователям с вопросами о платформе Staffix.

## ПРАВИЛА ОБЩЕНИЯ (КРИТИЧНО)
- ВСЕГДА обращайся к собеседнику на "Вы". НИКОГДА не переходи на "ты", даже если собеседник пишет тебе на "ты".
- ВСЕГДА начинай первое сообщение с "Здравствуйте" или "Добрый день/вечер". НИКОГДА не используй "Привет", "Эй", "Хай", "Здорово", "Слушай" в качестве приветствия — это слишком фамильярно.
- Тон — вежливый, профессиональный, тёплый. Краткие сообщения по делу.
- Допускаются вежливые разговорные обороты: "честно говоря", "на самом деле", "если позволите", "кстати" — но без фамильярности.
- Можно использовать вежливые эмоциональные реакции (одну на сообщение): "Понимаю Вас.", "Хороший вопрос.", "Конечно.", "Безусловно.", "Рад был помочь."
- ЗАПРЕЩЕНО: "Прикольно", "Круто", "Топ", "Жиза", "Ооо", ")" вместо эмодзи.
- Эмодзи — умеренно, 0–1 на сообщение.
- Отвечай на языке пользователя (русский / английский / узбекский / казахский).

## О Staffix:
- Staffix позволяет бизнесам создавать AI-сотрудников в Telegram, WhatsApp, Instagram, Facebook
- AI-сотрудник отвечает клиентам, записывает на услуги, принимает заказы, отвечает на FAQ
- Тарифы: Trial (14 дней, 100 сообщений), Starter $20 (200), Pro $45 (1000), Business $95 (3000), Enterprise $180 (безлимит)

## Возможности платформы:
- Настройка AI-сотрудника (характер, стиль общения, имя)
- Подключение Telegram, WhatsApp, Instagram, Facebook Messenger
- Услуги/товары, цены, импорт из Excel
- Команда/мастера, расписание, отгулы
- База знаний (FAQ и документы — PDF, Word, Excel)
- Онлайн-запись клиентов с напоминаниями за 24ч и 2ч
- CRM, сегменты клиентов, рассылки
- Статистика и аналитика
- Программа лояльности (кэшбэк, тиры)
- Финансы команды (ставки + комиссии + премии/штрафы)

## Как помочь с настройкой:
1. AI-сотрудник: Дашборд → AI-сотрудник → База знаний (имя бота, характер, документы)
2. Telegram бот: Создать через @BotFather, получить токен, вставить в Каналы
3. Услуги: Раздел "Мои услуги" → добавить название, цену, длительность (или импорт CSV)
4. База знаний: Раздел "База знаний" → загрузить документы или добавить FAQ

## Правила работы:
- Отвечай кратко и по делу
- Если не знаешь ответ — честно скажи и предложи связаться со специалистом
- Не выдумывай информацию о функциях которых нет
- При технических проблемах с аккаунтом — эскалируй

## Эскалация:
Если вопрос сложный или требует доступа к аккаунту пользователя, скажи:
"Для решения этого вопроса мне нужно передать Ваше обращение нашему специалисту. Он свяжется с Вами в ближайшее время."

Всегда старайся помочь сам, эскалируй только когда действительно необходимо.`;

// Send message to Telegram
async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  if (!botToken) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

// Send typing action
async function sendTypingAction(chatId: number): Promise<void> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  if (!botToken) return;

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
    // Ignore errors
  }
}

// Handle admin reply to ticket
async function handleAdminReply(
  ticketIdShort: string,
  replyMessage: string,
  adminChatId: string
): Promise<string> {
  try {
    // Find ticket by short ID (last 8 chars)
    const tickets = await prisma.supportTicket.findMany({
      where: {
        id: { endsWith: ticketIdShort },
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    if (tickets.length === 0) {
      return `❌ Тикет с ID "${ticketIdShort}" не найден.`;
    }

    if (tickets.length > 1) {
      return `⚠️ Найдено несколько тикетов. Используйте полный ID.`;
    }

    const ticket = tickets[0];

    // Save the reply message
    await prisma.supportMessage.create({
      data: {
        content: replyMessage,
        isFromSupport: true,
        ticketId: ticket.id,
      },
    });

    // Update ticket status to in_progress if it was open
    if (ticket.status === "open") {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "in_progress" },
      });
    }

    return `✅ Ответ отправлен!\n\n<b>Тикет:</b> ${ticketIdShort}\n<b>Клиент:</b> ${ticket.user.name || ticket.user.email}\n<b>Ваш ответ:</b>\n${replyMessage}`;
  } catch (error) {
    console.error("Error handling admin reply:", error);
    return `❌ Ошибка при сохранении ответа. Попробуйте позже.`;
  }
}

// Notify admin about escalation
async function notifyAdminEscalation(
  userName: string,
  userMessage: string,
  chatId: number
): Promise<void> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  const adminChatId = process.env.SUPPORT_CHAT_ID;

  if (!botToken || !adminChatId) return;

  const message =
    `🔔 <b>Эскалация из поддержки</b>\n\n` +
    `<b>Пользователь:</b> ${userName}\n` +
    `<b>Chat ID:</b> ${chatId}\n\n` +
    `<b>Сообщение:</b>\n${userMessage}`;

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
    console.error("Error notifying admin:", error);
  }
}

// Generate AI response
async function generateAIResponse(
  userMessage: string,
  chatId: number,
  userName: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return "Извините, сервис временно недоступен. Попробуйте позже.";
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    // Get or create conversation history
    let history = conversationHistory.get(chatId) || [];

    // Keep only last 10 messages for context
    if (history.length > 20) {
      history = history.slice(-20);
    }

    // Add user message to history
    history.push({ role: "user", content: userMessage });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Извините, не могу обработать ваш запрос.";

    // Add assistant response to history
    history.push({ role: "assistant", content: assistantMessage });
    conversationHistory.set(chatId, history);

    // Check if escalation is needed
    if (
      assistantMessage.includes("передать ваше обращение") ||
      assistantMessage.includes("специалисту")
    ) {
      await notifyAdminEscalation(userName, userMessage, chatId);
    }

    return assistantMessage;
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже или напишите нам на сайте staffix.io";
  }
}

// Webhook handler
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    // Only process text messages
    if (!update.message?.text) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    const userMessage = message.text || "";
    const userName = message.from.first_name + (message.from.last_name ? ` ${message.from.last_name}` : "");

    // Handle /start command
    if (userMessage === "/start") {
      await sendTelegramMessage(
        chatId,
        `Здравствуйте, ${message.from.first_name}! 👋\n\n` +
          `Я AI-помощник службы поддержки Staffix.\n\n` +
          `Задайте мне вопрос о платформе, и я постараюсь помочь:\n` +
          `• Как настроить AI-сотрудника\n` +
          `• Как подключить Telegram бота\n` +
          `• Вопросы о тарифах\n` +
          `• Технические проблемы\n\n` +
          `Просто напишите ваш вопрос!`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /help command
    if (userMessage === "/help") {
      await sendTelegramMessage(
        chatId,
        `<b>Чем я могу помочь:</b>\n\n` +
          `• Ответить на вопросы о Staffix\n` +
          `• Помочь с настройкой AI-сотрудника\n` +
          `• Объяснить как подключить Telegram бота\n` +
          `• Рассказать о тарифах\n\n` +
          `<b>Команды:</b>\n` +
          `/start - Начать сначала\n` +
          `/help - Показать эту справку\n` +
          `/human - Связаться с живым оператором`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /human command - escalate to human
    if (userMessage === "/human") {
      await notifyAdminEscalation(userName, "Пользователь запросил связь с оператором", chatId);
      await sendTelegramMessage(
        chatId,
        `Ваш запрос передан нашему специалисту. Он свяжется с вами в ближайшее время.\n\n` +
          `Пока ожидаете, вы можете задать мне другие вопросы — возможно, я смогу помочь!`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /reply command (admin only)
    const adminChatId = process.env.SUPPORT_CHAT_ID;
    if (userMessage.startsWith("/reply ") && String(chatId) === adminChatId) {
      // Parse: /reply TICKET_ID message
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

      const result = await handleAdminReply(ticketIdShort, replyMessage, adminChatId);
      await sendTelegramMessage(chatId, result);
      return NextResponse.json({ ok: true });
    }

    // Handle /tickets command (admin only) - show open tickets
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
            msg += `${status} <code>${shortId}</code> - ${t.subject}\n`;
            msg += `   👤 ${t.user.name || t.user.email}\n\n`;
          }
          msg += `\n💬 Ответить: <code>/reply ID сообщение</code>`;
          await sendTelegramMessage(chatId, msg);
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
        await sendTelegramMessage(chatId, "❌ Ошибка при загрузке тикетов");
      }
      return NextResponse.json({ ok: true });
    }

    // Show typing indicator
    await sendTypingAction(chatId);

    // Generate AI response
    const aiResponse = await generateAIResponse(userMessage, chatId, userName);

    // Send response
    await sendTelegramMessage(chatId, aiResponse);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// Verify webhook (for setup)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Staffix Support Bot Webhook",
  });
}
