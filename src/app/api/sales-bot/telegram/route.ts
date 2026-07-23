import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateStaffixSalesResponse } from "@/lib/staffix-sales-ai";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { upsertSalesLead } from "@/lib/sales-bot/upsert-lead";

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
    voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
    audio?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
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

// Conversation history helpers — persisted in SalesLead.history (DB-backed)
type HistoryMessage = { role: "user" | "assistant"; content: string };

async function getLeadHistory(chatId: number): Promise<HistoryMessage[]> {
  try {
    const lead = await prisma.salesLead.findUnique({
      where: { telegramChatId: BigInt(chatId) },
      select: { history: true },
    });
    return (lead?.history as HistoryMessage[]) || [];
  } catch {
    return [];
  }
}

async function saveLeadHistory(chatId: number, history: HistoryMessage[]): Promise<void> {
  try {
    await prisma.salesLead.updateMany({
      where: { telegramChatId: BigInt(chatId) },
      data: { history: history.slice(-40) as unknown as [] },
    });
  } catch {
    // Lead may not exist yet — will be created on next upsert
  }
}

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

// Save or update lead in database (TG-specific wrapper вокруг общего helper).
async function upsertTelegramLead(
  telegramId: number,
  chatId: number,
  username: string | undefined,
  firstName: string,
  lastName: string | undefined
): Promise<void> {
  const name = firstName + (lastName ? ` ${lastName}` : "");
  await upsertSalesLead({
    channel: "telegram",
    telegramId: BigInt(telegramId),
    telegramChatId: BigInt(chatId),
    telegramUsername: username || null,
    name,
  });
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

// generateAIResponse replaced by generateStaffixSalesResponse (with tool support)

// Webhook handler
export async function POST(request: NextRequest) {
  try {
    // Verify Telegram secret_token — иначе любой может слать фейковые SalesLead.
    // Если SALES_BOT_TELEGRAM_SECRET не настроен — пропускаем (для совместимости со старым деплоем),
    // но логируем громкое предупреждение чтобы это было видно в Vercel.
    const expectedSecret = process.env.SALES_BOT_TELEGRAM_SECRET;
    if (expectedSecret) {
      const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
      if (!receivedSecret || receivedSecret !== expectedSecret) {
        console.error("[sales-bot/tg] invalid secret_token — rejecting webhook");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } else {
      console.warn(
        "[sales-bot/tg] SALES_BOT_TELEGRAM_SECRET not set — webhook is unauthenticated! " +
        "Set the env var and re-register webhook with secret_token via Telegram setWebhook."
      );
    }

    // Rate limiting: 30 requests per minute per IP
    const ip = getClientIp(request);
    const rl = await rateLimit(`sales-tg:${ip}`, 30, 1);
    if (!rl.allowed) {
      return NextResponse.json({ ok: true }); // Telegram expects 200 even on rejection
    }

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

    // Only process text/voice/audio messages
    if (!update.message?.text && !update.message?.voice && !update.message?.audio) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    let userMessage = message.text || "";
    const userName =
      message.from.first_name +
      (message.from.last_name ? ` ${message.from.last_name}` : "");

    // Transcribe voice/audio via Groq Whisper
    if (!userMessage && (message.voice || message.audio)) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      const botToken = process.env.SALES_BOT_TELEGRAM_TOKEN;
      if (botToken && fileId) {
        try {
          const { downloadTelegramFile, transcribeAudio } = await import("@/lib/voice-ai");
          const buf = await downloadTelegramFile(botToken, fileId);
          const filename = message.voice ? "voice.ogg" : "audio.mp3";
          const result = await transcribeAudio(buf, filename);
          userMessage = (result.text || "").trim();
          console.log(`[Sales TG] Transcribed ${message.voice ? "voice" : "audio"} (${result.language || "?"}): "${userMessage.slice(0, 80)}"`);
        } catch (e) {
          console.error("[Sales TG] STT failed:", e);
        }
      }
      if (!userMessage) {
        await sendTelegramMessage(
          chatId,
          "Извините, не удалось распознать голосовое сообщение. Пожалуйста, напишите текстом или попробуйте записать ещё раз."
        );
        return NextResponse.json({ ok: true });
      }
    }

    // Save/update lead
    await upsertTelegramLead(
      message.from.id,
      chatId,
      message.from.username,
      message.from.first_name,
      message.from.last_name
    );

    // /start, /pricing, /help — НЕ ловим хард-кодом. Pos позиционируем Виктора
    // как полноценный AI-консультант (как user-боты в других каналах).
    // Все команды идут через generateStaffixSalesResponse — AI сам строит ответ
    // из system prompt + истории. Это даёт:
    //  - живой диалог с первого сообщения, а не дерево кнопок
    //  - запись в SalesLead.history (видно в /admin/messages)
    //  - тот же UX что в IG/WA (там кнопок не было — бот сразу общался)
    //
    // Старые callback_query handlers (pricing/features/try_free/demo) выше в коде
    // оставлены для backwards compat — если у кого-то открыто старое сообщение с
    // кнопками, нажатие сработает. Новые /start уже без кнопок.

    // Show typing indicator
    await sendTypingAction(chatId);

    // Generate AI response (with tool support: schedule_demo, notify_owner)
    const aiResponse = await generateStaffixSalesResponse(
      "telegram",
      String(chatId),
      userMessage,
      userName
    );

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
