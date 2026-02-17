import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getSalesSystemPrompt } from "@/lib/sales-bot/system-prompt";

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
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      chat: { id: number };
      message_id: number;
    };
    data?: string;
  };
}

// In-memory conversation history (for serverless, consider DB-backed approach)
const conversationHistory: Map<
  number,
  Array<{ role: "user" | "assistant"; content: string }>
> = new Map();

// Send message to Telegram
async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: object
): Promise<boolean> {
  const botToken = process.env.SALES_BOT_TELEGRAM_TOKEN;
  if (!botToken) return false;

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Sales bot: Error sending Telegram message:", error);
    return false;
  }
}

// Send typing action
async function sendTypingAction(chatId: number): Promise<void> {
  const botToken = process.env.SALES_BOT_TELEGRAM_TOKEN;
  if (!botToken) return;

  try {
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendChatAction`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: "typing" }),
      }
    );
  } catch {
    // Ignore
  }
}

// Notify admin about hot lead
async function notifyAdmin(
  leadInfo: string
): Promise<void> {
  const botToken = process.env.SALES_BOT_TELEGRAM_TOKEN;
  const adminChatId = process.env.SALES_ADMIN_CHAT_ID;
  if (!botToken || !adminChatId) return;

  try {
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: leadInfo,
          parse_mode: "HTML",
        }),
      }
    );
  } catch {
    // Ignore
  }
}

// Save or update lead in database
async function upsertSalesLead(
  telegramId: number,
  chatId: number,
  username: string | undefined,
  firstName: string,
  lastName: string | undefined
): Promise<void> {
  try {
    const name = firstName + (lastName ? ` ${lastName}` : "");
    await prisma.salesLead.upsert({
      where: { telegramChatId: BigInt(chatId) },
      create: {
        telegramId: BigInt(telegramId),
        telegramUsername: username || null,
        telegramChatId: BigInt(chatId),
        name,
        channel: "telegram",
        stage: "new",
      },
      update: {
        name,
        telegramUsername: username || undefined,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Sales bot: Error upserting lead:", error);
  }
}

// Update lead stage
async function updateLeadStage(
  chatId: number,
  stage: string,
  extraData?: Record<string, string | null>
): Promise<void> {
  try {
    await prisma.salesLead.update({
      where: { telegramChatId: BigInt(chatId) },
      data: { stage, ...extraData },
    });
  } catch {
    // Lead might not exist yet
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
    return "Извините, сервис временно недоступен. Пожалуйста, посетите https://staffix.io";
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    // Get or create conversation history
    let history = conversationHistory.get(chatId) || [];

    // Keep last 20 messages for context
    if (history.length > 20) {
      history = history.slice(-20);
    }

    // Add user message
    history.push({ role: "user", content: userMessage });

    const systemPrompt =
      getSalesSystemPrompt() +
      `\n\nТекущий собеседник: ${userName} (Telegram chat ID: ${chatId})`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Извините, не могу обработать ваш запрос.";

    // Add assistant response to history
    history.push({ role: "assistant", content: assistantMessage });
    conversationHistory.set(chatId, history);

    // Detect lead stage transitions based on AI response content
    const lowerMsg = (userMessage + " " + assistantMessage).toLowerCase();
    if (
      lowerMsg.includes("попробовать") ||
      lowerMsg.includes("пробный") ||
      lowerMsg.includes("бесплатн") ||
      lowerMsg.includes("trial") ||
      lowerMsg.includes("зарегистрир")
    ) {
      await updateLeadStage(chatId, "interested");
    }
    if (
      lowerMsg.includes("staffix.io") &&
      (lowerMsg.includes("перейду") ||
        lowerMsg.includes("посмотрю") ||
        lowerMsg.includes("зайду"))
    ) {
      await updateLeadStage(chatId, "trial_started");
      // Notify admin about hot lead
      await notifyAdmin(
        `🔥 <b>Горячий лид!</b>\n\n` +
          `<b>Имя:</b> ${userName}\n` +
          `<b>Chat ID:</b> ${chatId}\n` +
          `<b>Статус:</b> Переходит на staffix.io для регистрации`
      );
    }

    return assistantMessage;
  } catch (error) {
    console.error("Sales bot: Error generating AI response:", error);
    return "Произошла ошибка. Пожалуйста, попробуйте позже или посетите https://staffix.io";
  }
}

// Webhook handler
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    // Handle callback queries
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat.id;
      if (!chatId) return NextResponse.json({ ok: true });

      const userName =
        cb.from.first_name +
        (cb.from.last_name ? ` ${cb.from.last_name}` : "");

      // Acknowledge callback
      const botToken = process.env.SALES_BOT_TELEGRAM_TOKEN;
      if (botToken) {
        await fetch(
          `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id }),
          }
        );
      }

      if (cb.data === "pricing") {
        await sendTelegramMessage(
          chatId,
          `💰 <b>Тарифы Staffix</b>\n\n` +
            `🆓 <b>Пробный</b> — Бесплатно (14 дней, 100 сообщений)\n` +
            `📦 <b>Starter</b> — $20/мес (200 сообщений)\n` +
            `⭐ <b>Pro</b> — $45/мес (1000 сообщений) ★ Популярный\n` +
            `🏢 <b>Business</b> — $95/мес (3000 сообщений)\n` +
            `🏭 <b>Enterprise</b> — $180/мес (безлимит)\n\n` +
            `Годовая оплата — скидка 20%!\n` +
            `Все планы включают ВСЕ функции.\n\n` +
            `Хотите подобрать оптимальный план для вашего бизнеса?`
        );
      } else if (cb.data === "features") {
        await sendTelegramMessage(
          chatId,
          `🚀 <b>Что умеет Staffix</b>\n\n` +
            `🤖 AI-сотрудник — отвечает клиентам 24/7\n` +
            `📅 Онлайн-запись — без ошибок и двойных записей\n` +
            `👥 CRM — полная база клиентов\n` +
            `🔔 Напоминания — снижают неявки на 40-60%\n` +
            `⭐ Сбор отзывов — автоматически после визита\n` +
            `📢 Рассылки — акции и скидки по сегментам\n` +
            `🔄 Реактивация — возвращает "спящих" клиентов\n` +
            `📊 Аналитика — все метрики в реальном времени\n` +
            `📚 База знаний — AI учится из ваших документов\n\n` +
            `Какая функция вас интересует больше всего?`
        );
      } else if (cb.data === "try_free") {
        await updateLeadStage(chatId, "interested");
        await sendTelegramMessage(
          chatId,
          `🎉 <b>Отлично!</b>\n\n` +
            `Начать бесплатный пробный период очень просто:\n\n` +
            `1️⃣ Перейдите на <b>staffix.io</b>\n` +
            `2️⃣ Нажмите "Начать бесплатно"\n` +
            `3️⃣ Введите email и пароль\n` +
            `4️⃣ Создайте бота через @BotFather\n` +
            `5️⃣ Добавьте услуги — и готово!\n\n` +
            `Настройка занимает 5-10 минут.\n` +
            `14 дней, 100 сообщений, без карты.\n\n` +
            `👉 <b>https://staffix.io</b>\n\n` +
            `Если нужна помощь с настройкой — пишите, помогу!`
        );
        await notifyAdmin(
          `🔥 <b>Лид хочет попробовать!</b>\n\n` +
            `<b>Имя:</b> ${userName}\n` +
            `<b>Username:</b> @${cb.from.username || "—"}\n` +
            `<b>Chat ID:</b> ${chatId}`
        );
      } else if (cb.data === "demo") {
        await updateLeadStage(chatId, "demo_requested");
        await sendTelegramMessage(
          chatId,
          `📞 <b>Демонстрация Staffix</b>\n\n` +
            `Отлично! Я могу организовать для вас персональную демонстрацию.\n\n` +
            `Напишите удобное время для звонка (Zoom/Telegram), и наш специалист покажет все возможности Staffix на живом примере.\n\n` +
            `Или напишите нам: director.kbridge@gmail.com`
        );
        await notifyAdmin(
          `📞 <b>Запрос на демо!</b>\n\n` +
            `<b>Имя:</b> ${userName}\n` +
            `<b>Username:</b> @${cb.from.username || "—"}\n` +
            `<b>Chat ID:</b> ${chatId}\n\n` +
            `Свяжитесь с лидом для назначения демо!`
        );
      }

      return NextResponse.json({ ok: true });
    }

    // Only process text messages
    if (!update.message?.text) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    const userMessage = message.text || "";
    const userName =
      message.from.first_name +
      (message.from.last_name ? ` ${message.from.last_name}` : "");

    // Save/update lead
    await upsertSalesLead(
      message.from.id,
      chatId,
      message.from.username,
      message.from.first_name,
      message.from.last_name
    );

    // Handle /start command
    if (userMessage === "/start") {
      await sendTelegramMessage(
        chatId,
        `Здравствуйте, ${message.from.first_name}! 👋\n\n` +
          `Я — консультант <b>Staffix</b>, платформы AI-сотрудников для бизнеса.\n\n` +
          `Staffix — это AI, который отвечает вашим клиентам 24/7, записывает на услуги, ведёт CRM и напоминает о визитах. Всё автоматически, от <b>$20/мес</b>.\n\n` +
          `Чем могу помочь?`,
        {
          inline_keyboard: [
            [
              { text: "💰 Тарифы", callback_data: "pricing" },
              { text: "🚀 Возможности", callback_data: "features" },
            ],
            [
              { text: "🎁 Попробовать бесплатно", callback_data: "try_free" },
              { text: "📞 Демонстрация", callback_data: "demo" },
            ],
          ],
        }
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /pricing command
    if (userMessage === "/pricing" || userMessage === "/prices") {
      await sendTelegramMessage(
        chatId,
        `💰 <b>Тарифы Staffix</b>\n\n` +
          `🆓 <b>Пробный</b> — Бесплатно (14 дней, 100 сообщений)\n` +
          `📦 <b>Starter</b> — $20/мес (200 сообщений)\n` +
          `⭐ <b>Pro</b> — $45/мес (1000 сообщений) ★ Популярный\n` +
          `🏢 <b>Business</b> — $95/мес (3000 сообщений)\n` +
          `🏭 <b>Enterprise</b> — $180/мес (безлимит)\n\n` +
          `Годовая оплата — скидка 20%!\n` +
          `Все планы включают ВСЕ функции.\n\n` +
          `👉 Попробуйте бесплатно: <b>https://staffix.io</b>`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /help command
    if (userMessage === "/help") {
      await sendTelegramMessage(
        chatId,
        `<b>Staffix — AI-сотрудник для вашего бизнеса</b>\n\n` +
          `Я могу рассказать вам о:\n` +
          `• Возможностях Staffix\n` +
          `• Тарифах и ценах\n` +
          `• Настройке и запуске\n` +
          `• Подборе плана для вашего бизнеса\n\n` +
          `<b>Команды:</b>\n` +
          `/start — Главное меню\n` +
          `/pricing — Тарифы\n` +
          `/help — Справка\n\n` +
          `Или просто напишите ваш вопрос!`
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
    console.error("Sales bot webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// Verify webhook (for setup)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Staffix Sales Bot Webhook",
  });
}
