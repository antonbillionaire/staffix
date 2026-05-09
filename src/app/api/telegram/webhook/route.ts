/**
 * Main Telegram Bot Webhook for Business AI Employees.
 *
 * Тонкий слой над lib/telegram/* модулями:
 *  - Авторизация (businessId / legacy token + secret_token хедер)
 *  - Rate limiting (30 req/min на бизнес)
 *  - Дедупликация (markWebhookProcessed по update_id)
 *  - Роутинг: callback_query → callbacks.ts, /start → start-handler.ts,
 *    voice/audio → voice-ai, contact/location → inline, /lang → inline,
 *    pending review comment → inline, обычный текст → ai.ts
 *
 * Логика обработки сообщений и AI-ответы вынесены в lib/telegram/.
 */

// Vercel Pro: allow up to 300 seconds for AI processing
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { markWebhookProcessed } from "@/lib/webhook-dedup";
import {
  TelegramUpdate,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramMessageWithButtons,
  sendTypingAction,
} from "@/lib/telegram/api";
import { handleCallbackQuery } from "@/lib/telegram/callbacks";
import { handleStartCommand } from "@/lib/telegram/start-handler";
import { generateAIResponse } from "@/lib/telegram/ai";
import { logActivityFireAndForget } from "@/lib/activity-log";

async function findBusinessByBotToken(
  botToken: string
): Promise<{ id: string; name: string } | null> {
  try {
    const business = await prisma.business.findUnique({
      where: { botToken },
      select: { id: true, name: true },
    });
    return business;
  } catch {
    return null;
  }
}

async function checkMessageLimit(businessId: string): Promise<{
  allowed: boolean;
  remaining: number;
  plan: string;
}> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) {
      return { allowed: false, remaining: 0, plan: "none" };
    }

    if (new Date() > subscription.expiresAt) {
      return { allowed: false, remaining: 0, plan: subscription.plan };
    }

    // -1 = безлимит для enterprise
    if (subscription.messagesLimit === -1) {
      return { allowed: true, remaining: -1, plan: subscription.plan };
    }

    const remaining = subscription.messagesLimit - subscription.messagesUsed;

    if (remaining <= 0) {
      return { allowed: false, remaining: 0, plan: subscription.plan };
    }

    return { allowed: true, remaining, plan: subscription.plan };
  } catch {
    return { allowed: false, remaining: 0, plan: "error" };
  }
}

async function incrementMessageUsage(businessId: string): Promise<void> {
  try {
    await prisma.subscription.update({
      where: { businessId },
      data: { messagesUsed: { increment: 1 } },
    });
  } catch (error) {
    console.error("Error incrementing message usage:", error);
  }
}

export async function POST(request: NextRequest) {
  // Сохраняем как можно раньше — чтобы catch мог отправить fallback клиенту
  let catchBotToken: string | null = null;
  let catchChatId: number | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const legacyToken = searchParams.get("token"); // legacy support

    let business: {
      id: string;
      name: string;
      botToken: string;
      webhookSecret: string | null;
      ownerTelegramChatId: bigint | null;
    } | null = null;
    let botToken: string | null = null;

    if (businessId) {
      const foundBusiness = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, botToken: true, webhookSecret: true, ownerTelegramChatId: true },
      });
      if (foundBusiness?.botToken) {
        business = {
          id: foundBusiness.id,
          name: foundBusiness.name,
          botToken: foundBusiness.botToken,
          webhookSecret: foundBusiness.webhookSecret,
          ownerTelegramChatId: foundBusiness.ownerTelegramChatId,
        };
        botToken = foundBusiness.botToken;
      }
    } else if (legacyToken) {
      const foundBusiness = await findBusinessByBotToken(legacyToken);
      if (foundBusiness) {
        const fullBusiness = await prisma.business.findUnique({
          where: { id: foundBusiness.id },
          select: { id: true, name: true, botToken: true, webhookSecret: true, ownerTelegramChatId: true },
        });
        if (fullBusiness?.botToken) {
          business = {
            id: fullBusiness.id,
            name: fullBusiness.name,
            botToken: fullBusiness.botToken,
            webhookSecret: fullBusiness.webhookSecret,
            ownerTelegramChatId: fullBusiness.ownerTelegramChatId,
          };
          botToken = fullBusiness.botToken;
        }
      }
    }

    if (!business || !botToken) {
      return NextResponse.json({ error: "Invalid business or token" }, { status: 401 });
    }

    catchBotToken = botToken;

    // Rate limiting — защита от flood
    const rlResult = await rateLimit(`tg-webhook:${business.id}`, 30, 1);
    if (!rlResult.allowed) {
      return NextResponse.json({ ok: true }); // Telegram ожидает 200 даже при отклонении
    }

    const rawBody = await request.text();

    // Верификация secret_token (Telegram шлёт его в X-Telegram-Bot-Api-Secret-Token)
    const receivedToken = request.headers.get("x-telegram-bot-api-secret-token");
    if (!business.webhookSecret) {
      console.error(
        `Telegram webhook: no webhookSecret configured for businessId=${businessId} — rejecting`
      );
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 403 });
    }
    if (!receivedToken || receivedToken !== business.webhookSecret) {
      console.error(`Telegram webhook: invalid secret_token for businessId=${businessId}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const update: TelegramUpdate = JSON.parse(rawBody);

    // Дедупликация повторных доставок
    const dedupId = `tg-${update.update_id}`;
    if (!(await markWebhookProcessed(dedupId))) {
      return NextResponse.json({ ok: true });
    }

    // Inline buttons
    if (update.callback_query) {
      await handleCallbackQuery(botToken, business.id, update.callback_query);
      return NextResponse.json({ ok: true });
    }

    // Поддерживаемые типы: текст, контакт, геолокация, голосовое, аудио
    if (
      !update.message?.text &&
      !update.message?.contact &&
      !update.message?.location &&
      !update.message?.voice &&
      !update.message?.audio
    ) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    catchChatId = chatId;
    const telegramId = BigInt(message.from.id);
    let userMessage = message.text || "";

    // STT голосовых/аудио через Groq Whisper
    if (!userMessage && (message.voice || message.audio)) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      try {
        const { downloadTelegramFile, transcribeAudio } = await import("@/lib/voice-ai");
        const buf = await downloadTelegramFile(botToken, fileId!);
        const filename = message.voice ? "voice.ogg" : "audio.mp3";
        const result = await transcribeAudio(buf, filename);
        userMessage = (result.text || "").trim();
        console.log(
          `[Webhook] Transcribed ${message.voice ? "voice" : "audio"} (${result.language || "?"}): "${userMessage.slice(0, 80)}"`
        );
      } catch (e) {
        console.error("[Webhook] STT failed:", e);
      }
      if (!userMessage) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Извините, не удалось распознать голосовое сообщение. Пожалуйста, напишите текстом или попробуйте записать ещё раз."
        );
        return NextResponse.json({ ok: true });
      }
    }
    const userName =
      message.from.first_name + (message.from.last_name ? ` ${message.from.last_name}` : "");
    // @username из Telegram (без @). Может быть undefined если у юзера не задан handle.
    const telegramUsername = message.from.username || null;

    // Обработка контакта (поделился номером)
    if (message.contact) {
      const phone = message.contact.phone_number;
      // Brand-new lead через shared contact → auto-assign продавцу по lead-distribution.
      // Существующий клиент сохраняет текущего владельца.
      const existing = await prisma.client.findUnique({
        where: { businessId_telegramId: { businessId: business.id, telegramId } },
        select: { id: true },
      });
      let autoAssign: string | null = null;
      if (!existing) {
        const { pickStaffForNewLead } = await import("@/lib/lead-assignment");
        autoAssign = await pickStaffForNewLead(business.id);
      }
      await prisma.client.upsert({
        where: {
          businessId_telegramId: {
            businessId: business.id,
            telegramId,
          },
        },
        create: {
          businessId: business.id,
          telegramId,
          telegramUsername,
          phone,
          name: message.contact.first_name,
          assignedStaffId: autoAssign,
        },
        update: {
          phone,
          name: message.contact.first_name,
          telegramUsername: telegramUsername || undefined,
        },
      });

      await sendTelegramMessage(
        botToken,
        chatId,
        `Спасибо! Ваш номер ${phone} сохранён. Чем могу помочь?`
      );
      return NextResponse.json({ ok: true });
    }

    // Геолокация (для доставки)
    if (message.location) {
      const { latitude, longitude } = message.location;
      const googleLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      // У Яндекса в pt= обратный порядок: сначала долгота, потом широта.
      const yandexLink = `https://yandex.com/maps/?pt=${longitude},${latitude}&z=16&l=map`;
      const clientName = userName || "Клиент";

      const mapButtons = [
        [
          { text: "🗺 Google Maps", url: googleLink },
          { text: "🗺 Яндекс Карты", url: yandexLink },
        ],
      ];

      const sendMapMessage = async (notifyBot: string, toChatId: number, text: string) => {
        await fetch(`https://api.telegram.org/bot${notifyBot}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: toChatId,
            text,
            reply_markup: { inline_keyboard: mapButtons },
          }),
        }).catch((e) => console.error("[Webhook] location notify error:", e));
      };

      // Уведомляем владельца
      const ownerChatId = business.ownerTelegramChatId;
      if (ownerChatId && business.botToken) {
        await sendMapMessage(
          business.botToken,
          Number(ownerChatId),
          `📍 ${clientName} отправил геолокацию\n\nTelegram ID: ${message.from.id}`
        );
      }

      // Уведомляем сотрудников с включёнными уведомлениями
      const staffWithNotify = await prisma.staff.findMany({
        where: {
          businessId: business.id,
          notificationsEnabled: true,
          telegramChatId: { not: null },
        },
        select: { telegramChatId: true },
      });
      for (const s of staffWithNotify) {
        if (s.telegramChatId) {
          await sendMapMessage(
            botToken,
            Number(s.telegramChatId),
            `📍 ${clientName} отправил геолокацию`
          );
        }
      }

      await sendTelegramMessage(
        botToken,
        chatId,
        `📍 Спасибо! Ваша геолокация получена и передана менеджеру. Мы свяжемся с вами для подтверждения доставки.`
      );
      return NextResponse.json({ ok: true });
    }

    // /start (с возможным параметром: client_<id> / s_<staffId>)
    if (userMessage === "/start" || userMessage.startsWith("/start ")) {
      const senderUsername = message.from.username?.toLowerCase().replace("@", "") || "";
      await handleStartCommand({
        botToken,
        businessId: business.id,
        chatId,
        telegramId,
        senderUsername,
        userMessage,
        userName,
      });
      return NextResponse.json({ ok: true });
    }

    // /lang — выбор языка клиентом
    if (userMessage === "/lang") {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🌐 Выберите язык / Choose language / Tilni tanlang:",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🇷🇺 Русский", callback_data: "set_lang:ru" },
                { text: "🇬🇧 English", callback_data: "set_lang:en" },
              ],
              [
                { text: "🇺🇿 O'zbek", callback_data: "set_lang:uz" },
                { text: "🇰🇿 Қазақша", callback_data: "set_lang:kz" },
              ],
            ],
          },
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // PENDING REVIEW COMMENT — клиент только что поставил оценку, теперь ждём текст
    if (userMessage && !userMessage.startsWith("/")) {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const pendingReview = await prisma.review.findFirst({
        where: {
          clientTelegramId: telegramId,
          businessId: business.id,
          comment: null,
          createdAt: { gte: fifteenMinsAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      if (pendingReview) {
        await prisma.review.update({
          where: { id: pendingReview.id },
          data: { comment: userMessage as string },
        });

        const [bizSettings, bizOwner] = await Promise.all([
          prisma.automationSettings.findUnique({ where: { businessId: business.id } }),
          prisma.business.findUnique({
            where: { id: business.id },
            select: { ownerTelegramChatId: true },
          }),
        ]);

        if (pendingReview.rating >= 4) {
          // Высокая оценка → просим выложить публично
          const buttons: { text: string; url: string }[] = [];
          if (bizSettings?.reviewGoogleLink) {
            buttons.push({ text: "📝 Google Maps", url: bizSettings.reviewGoogleLink! });
          }
          if (bizSettings?.review2gisLink) {
            buttons.push({ text: "📝 2GIS", url: bizSettings.review2gisLink! });
          }
          const yandexLink = (bizSettings as Record<string, unknown>)?.reviewYandexLink as
            | string
            | null
            | undefined;
          if (yandexLink) {
            buttons.push({ text: "📝 Яндекс.Карты", url: yandexLink });
          }

          const replyText = `Спасибо за ваш отзыв! 💜\n\nЕсли хотите помочь нам — поделитесь мнением на одной из платформ. Это займёт 1 минуту и очень поможет нашему бизнесу! 🙏`;

          if (buttons.length > 0) {
            await sendTelegramMessageWithButtons(botToken, chatId, replyText, [buttons]);
          } else {
            await sendTelegramMessage(botToken, chatId, replyText);
          }
        } else {
          // ≤3 → empathy + уведомление владельцу
          const clientMsg =
            pendingReview.rating <= 2
              ? `Спасибо, что рассказали нам об этом. 🙏\n\nМы обязательно разберёмся с ситуацией и свяжемся с вами, если потребуется. Нам важно, чтобы каждый визит был на высшем уровне.`
              : `Спасибо за честный отзыв! 🙏\n\nМы всегда стремимся стать лучше и обязательно обратим внимание на ваши слова.`;
          await sendTelegramMessage(botToken, chatId, clientMsg);

          const ownerChatId = bizOwner?.ownerTelegramChatId;
          if (ownerChatId) {
            const stars = "⭐".repeat(pendingReview.rating);
            const bookingInfo = pendingReview.bookingId
              ? ` (запись #${pendingReview.bookingId.slice(-6)})`
              : "";
            const emoji = pendingReview.rating <= 2 ? "⚠️" : "📝";
            const label = pendingReview.rating <= 2 ? "Низкая оценка" : "Средняя оценка";
            await sendTelegramMessage(
              botToken,
              Number(ownerChatId),
              `${emoji} ${label} от клиента!\n\nКлиент: ${pendingReview.clientName || "Неизвестен"}\nОценка: ${stars}\nКомментарий: "${userMessage}"${bookingInfo}\n\nРекомендуем связаться с клиентом и уточнить детали.`
            );
          }
        }

        return NextResponse.json({ ok: true });
      }
    }

    // Лимит сообщений
    const { allowed, plan } = await checkMessageLimit(business.id);

    if (!allowed) {
      let errorMsg = "К сожалению, лимит сообщений исчерпан. Пожалуйста, обратитесь к администратору.";

      if (plan === "none") {
        errorMsg = "Бот временно недоступен. Пожалуйста, свяжитесь с нами напрямую.";
      }

      await sendTelegramMessage(botToken, chatId, errorMsg);
      return NextResponse.json({ ok: true });
    }

    // Activity log: получено сообщение от клиента (для /dashboard/activity)
    logActivityFireAndForget({
      businessId: business.id,
      type: "message_received",
      severity: "info",
      summary: `Клиент ${userName || "(без имени)"}: «${userMessage.slice(0, 120)}${userMessage.length > 120 ? "…" : ""}»`,
      technical: {
        chatId: chatId.toString(),
        telegramId: telegramId.toString(),
        username: message.from.username || null,
        messageLength: userMessage.length,
      },
      channel: "telegram",
    });

    // Печатает...
    await sendTypingAction(botToken, chatId);

    console.log(
      `[Webhook] Generating AI response for business=${business.id}, msg="${userMessage.slice(0, 50)}..."`
    );
    const aiStart = Date.now();
    const aiResponse = await generateAIResponse(business.id, telegramId, userMessage, userName, telegramUsername);
    const aiLatencyMs = Date.now() - aiStart;
    console.log(
      `[Webhook] AI response generated (${aiResponse.text.length} chars, ${aiResponse.imageUrls.length} images)`
    );

    // Activity log: AI ответил
    logActivityFireAndForget({
      businessId: business.id,
      type: "ai_response",
      severity: "info",
      summary: `AI ответил клиенту (${(aiLatencyMs / 1000).toFixed(1)} сек, ${aiResponse.text.length} симв.)`,
      technical: {
        chatId: chatId.toString(),
        latencyMs: aiLatencyMs,
        responseLength: aiResponse.text.length,
        imageCount: aiResponse.imageUrls.length,
        responsePreview: aiResponse.text.slice(0, 200),
      },
      channel: "telegram",
    });

    await sendTelegramMessage(botToken, chatId, aiResponse.text);

    // Фото товаров (max 5)
    for (const imgUrl of aiResponse.imageUrls.slice(0, 5)) {
      await sendTelegramPhoto(botToken, chatId, imgUrl);
    }

    // Не блокируем ответ счётчиком
    incrementMessageUsage(business.id).catch((e) =>
      console.error("[Webhook] incrementMessageUsage error:", e)
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Webhook] TOP-LEVEL ERROR: ${errMsg}`, error);
    if (catchBotToken && catchChatId) {
      try {
        await fetch(`https://api.telegram.org/bot${catchBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: catchChatId,
            text: "Произошла техническая ошибка. Попробуйте написать снова через минуту.",
          }),
        });
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ ok: true }); // Всегда 200 для Telegram
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Staffix Business Bot Webhook with AI Memory",
    version: "1.0",
  });
}
