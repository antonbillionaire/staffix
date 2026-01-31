import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

## О Staffix:
- Staffix позволяет бизнесам создавать AI-ботов для Telegram
- AI-бот отвечает клиентам, записывает на услуги, отвечает на FAQ
- Есть 3 тарифа: Бесплатный (100 сообщений), Pro $50 (2000 сообщений), Business $100 (безлимит)
- Пробный период 14 дней с 100 сообщениями

## Возможности платформы:
- Настройка AI-сотрудника (характер, стиль общения)
- Подключение Telegram бота
- Добавление услуг и цен
- Управление командой/мастерами
- База знаний (FAQ и документы)
- Онлайн-запись клиентов
- Статистика и аналитика

## Как помочь с настройкой:
1. AI-сотрудник: Настройки → AI-сотрудник → выбрать характер и добавить информацию
2. Telegram бот: Создать бота через @BotFather, получить токен, вставить в настройки
3. Услуги: Раздел "Услуги" → добавить название, цену, длительность
4. База знаний: Раздел "База знаний" → загрузить документы или добавить FAQ

## Правила общения:
- Отвечай кратко и по делу
- Будь дружелюбным и профессиональным
- Если не знаешь ответ — предложи связаться с живым оператором
- Отвечай на русском языке
- Не выдумывай информацию о функциях которых нет

## Эскалация:
Если вопрос сложный или требует доступа к аккаунту пользователя, скажи:
"Для решения этого вопроса мне нужно передать ваше обращение нашему специалисту. Он свяжется с вами в ближайшее время."

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
      model: "claude-sonnet-4-20250514",
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
