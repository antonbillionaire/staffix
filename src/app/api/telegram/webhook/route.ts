/**
 * Main Telegram Bot Webhook for Business AI Employees
 * Интеграция с AI Memory System (Фаза 1)
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  buildClientContext,
  buildBusinessContext,
  buildSystemPrompt,
  updateClientAfterMessage,
  updateConversationMessageCount,
  extractClientName,
  extractPhone,
} from "@/lib/ai-memory";
import {
  bookingToolDefinitions,
  checkAvailability,
  createBooking,
  getServicesList,
  getStaffList,
  getClientBookings,
  cancelBooking,
} from "@/lib/booking-tools";
import { sendBookingNotification } from "@/lib/notifications";
import { formatDateRu } from "@/lib/automation";

// ========================================
// ТИПЫ
// ========================================

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
    contact?: {
      phone_number: string;
      first_name: string;
      last_name?: string;
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

// ========================================
// TELEGRAM HELPERS
// ========================================

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string
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
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

async function sendTelegramMessageWithButtons(
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

async function sendTypingAction(
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

// ========================================
// ПОИСК БИЗНЕСА ПО ТОКЕНУ
// ========================================

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

// ========================================
// ПРОВЕРКА ЛИМИТА СООБЩЕНИЙ
// ========================================

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

    // Проверяем срок действия
    if (new Date() > subscription.expiresAt) {
      return { allowed: false, remaining: 0, plan: subscription.plan };
    }

    // Проверяем лимит (для enterprise/unlimited -1 означает безлимит)
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

// Увеличиваем счётчик использованных сообщений
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

// ========================================
// РАБОТА С РАЗГОВОРАМИ
// ========================================

async function getOrCreateConversation(
  businessId: string,
  telegramId: bigint,
  clientName?: string
): Promise<{ id: string; messages: Array<{ role: string; content: string }> }> {
  try {
    // Ищем существующий разговор
    let conversation = await prisma.conversation.findUnique({
      where: {
        businessId_clientTelegramId: {
          businessId,
          clientTelegramId: telegramId,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 20, // Последние 20 сообщений для контекста
        },
      },
    });

    if (conversation) {
      return {
        id: conversation.id,
        messages: conversation.messages
          .reverse()
          .map((m) => ({ role: m.role, content: m.content })),
      };
    }

    // Создаём новый разговор
    conversation = await prisma.conversation.create({
      data: {
        businessId,
        clientTelegramId: telegramId,
        clientName,
        messageCount: 0,
      },
      include: { messages: true },
    });

    return { id: conversation.id, messages: [] };
  } catch (error) {
    console.error("Error getting conversation:", error);
    throw error;
  }
}

async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  try {
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
      },
    });
  } catch (error) {
    console.error("Error saving message:", error);
  }
}

// ========================================
// ГЕНЕРАЦИЯ AI ОТВЕТА
// ========================================

// ========================================
// ОБРАБОТКА TOOL CALLS
// ========================================

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, string>,
  businessId: string,
  telegramId: bigint
): Promise<string> {
  try {
    switch (toolName) {
      case "check_availability": {
        const results = await checkAvailability(
          businessId,
          toolInput.date,
          toolInput.service_id,
          toolInput.staff_id
        );
        return JSON.stringify(results);
      }

      case "create_booking": {
        const result = await createBooking(
          businessId,
          toolInput.date,
          toolInput.time,
          toolInput.client_name,
          telegramId,
          toolInput.service_id,
          toolInput.staff_id,
          toolInput.client_phone
        );
        return JSON.stringify(result);
      }

      case "get_services": {
        const services = await getServicesList(businessId);
        return JSON.stringify(services);
      }

      case "get_staff": {
        const staff = await getStaffList(businessId);
        return JSON.stringify(staff);
      }

      case "get_my_bookings": {
        const bookings = await getClientBookings(businessId, telegramId);
        return JSON.stringify(bookings);
      }

      case "cancel_booking": {
        const result = await cancelBooking(toolInput.booking_id, telegramId);
        return JSON.stringify(result);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Error in tool ${toolName}:`, error);
    return JSON.stringify({ error: "Ошибка выполнения инструмента" });
  }
}

async function generateAIResponse(
  businessId: string,
  telegramId: bigint,
  userMessage: string,
  userName: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return "Извините, сервис временно недоступен. Попробуйте позже.";
  }

  try {
    // 1. Загружаем контекст бизнеса
    const businessContext = await buildBusinessContext(businessId);
    if (!businessContext) {
      return "Извините, произошла ошибка. Попробуйте позже.";
    }

    // 2. Загружаем контекст клиента (AI Memory!)
    const clientContext = await buildClientContext(businessId, telegramId);

    // 3. Строим системный промпт с учётом памяти
    const systemPrompt = buildSystemPrompt(businessContext, clientContext);

    // 4. Получаем историю разговора
    const conversation = await getOrCreateConversation(
      businessId,
      telegramId,
      userName
    );

    // 5. Добавляем новое сообщение пользователя
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentMessages: any[] = [
      ...conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ].slice(-20);

    // 6. Вызываем Claude API с tools
    const anthropic = new Anthropic({ apiKey });

    // Сегодняшняя дата для контекста
    const today = new Date().toISOString().split("T")[0];
    const systemWithDate = systemPrompt + `\n\nСегодняшняя дата: ${today}. Используй инструменты для работы с записями.`;

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemWithDate,
      messages: recentMessages,
      tools: bookingToolDefinitions,
    });

    // 7. Обрабатываем tool_use в цикле (до 5 итераций)
    let iterations = 0;
    const maxIterations = 5;

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;

      // Собираем все tool_use блоки из ответа
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

      // Добавляем ответ ассистента в messages
      recentMessages.push({
        role: "assistant",
        content: response.content,
      });

      // Обрабатываем каждый tool call и добавляем результаты
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolResults: any[] = [];

      for (const block of toolUseBlocks) {
        if (block.type === "tool_use") {
          console.log(`[Webhook] Tool call: ${block.name}`, JSON.stringify(block.input));

          const result = await handleToolCall(
            block.name,
            block.input as Record<string, string>,
            businessId,
            telegramId
          );

          console.log(`[Webhook] Tool result for ${block.name}:`, result.substring(0, 200));

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Добавляем результаты tool в messages
      recentMessages.push({
        role: "user",
        content: toolResults,
      });

      // Вызываем Claude снова с результатами
      try {
        response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemWithDate,
          messages: recentMessages,
          tools: bookingToolDefinitions,
        });
      } catch (apiError) {
        // If API fails after successful tool execution, build response from tool results
        console.error("[Webhook] API error after tool execution:", apiError);

        // Try to extract useful info from the last tool results
        for (const tr of toolResults) {
          try {
            const parsed = JSON.parse(tr.content);
            if (parsed.success && parsed.details) {
              const d = parsed.details;
              return `Запись создана! ${d.serviceName} к мастеру ${d.staffName}, ${d.date} в ${d.time}. Ждём вас!`;
            }
          } catch { /* not JSON or no details */ }
        }
        return "Ваш запрос обработан. Если возникли вопросы, напишите ещё раз.";
      }
    }

    // 8. Извлекаем финальный текстовый ответ
    const textBlocks = response.content.filter((block) => block.type === "text");
    const assistantMessage =
      textBlocks.length > 0 && textBlocks[0].type === "text"
        ? textBlocks[0].text
        : "Извините, не могу обработать ваш запрос.";

    // 9. Сохраняем сообщения в базу
    await saveMessage(conversation.id, "user", userMessage);
    await saveMessage(conversation.id, "assistant", assistantMessage);

    // 10. Обновляем счётчик сообщений в разговоре
    await updateConversationMessageCount(conversation.id);

    // 11. Извлекаем и сохраняем информацию о клиенте
    const extractedName = extractClientName(userMessage);
    const extractedPhone = extractPhone(userMessage);

    // Обновляем клиента
    await updateClientAfterMessage(
      businessId,
      telegramId,
      extractedName || userName
    );

    // Если извлекли телефон - сохраняем
    if (extractedPhone) {
      await prisma.client.update({
        where: {
          businessId_telegramId: {
            businessId,
            telegramId,
          },
        },
        data: { phone: extractedPhone },
      });
    }

    return assistantMessage;
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.";
  }
}

// ========================================
// CALLBACK QUERY HELPERS
// ========================================

async function answerCallbackQuery(
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

async function editMessageText(
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

async function handleCallbackQuery(
  botToken: string,
  businessId: string,
  callbackQuery: NonNullable<TelegramUpdate["callback_query"]>
): Promise<void> {
  const data = callbackQuery.data || "";
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const telegramId = BigInt(callbackQuery.from.id);

  if (!chatId) return;

  // ---- CONFIRM BOOKING ----
  if (data.startsWith("confirm_")) {
    const bookingId = data.replace("confirm_", "");

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "confirmed" },
    });

    await answerCallbackQuery(botToken, callbackQuery.id, "Запись подтверждена!");

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        staff: { select: { id: true, name: true } },
        business: { select: { timezone: true, address: true } },
      },
    });

    if (booking && messageId) {
      await editMessageText(
        botToken, chatId, messageId,
        `✅ Запись подтверждена!\n\n📅 ${formatDateRu(booking.date, booking.business?.timezone)}\n${booking.service ? `💇 ${booking.service.name}` : ""}${booking.business?.address ? `\n📍 ${booking.business.address}` : ""}\n\nЖдём вас! 💜`
      );

      // Notify owner and staff about confirmation
      const bookingDate = new Date(booking.date);
      const dateStr = bookingDate.toISOString().split("T")[0];
      const timeStr = bookingDate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
      sendBookingNotification(businessId, "new_booking", {
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        serviceName: booking.service?.name || "Услуга",
        staffName: booking.staff?.name || "Любой мастер",
        date: dateStr,
        time: timeStr,
        bookingId,
        staffId: booking.staff?.id,
      }).catch((err) => console.error("Confirm notification error:", err));
    }
    return;
  }

  // ---- CANCEL BOOKING ----
  if (data.startsWith("cancel_")) {
    const bookingId = data.replace("cancel_", "");

    const result = await cancelBooking(bookingId, telegramId);

    if (result.success) {
      await answerCallbackQuery(botToken, callbackQuery.id, "Запись отменена");
      if (messageId) {
        await editMessageText(
          botToken, chatId, messageId,
          "❌ Запись отменена.\n\nЕсли хотите записаться снова — просто напишите!"
        );
      }
    } else {
      await answerCallbackQuery(botToken, callbackQuery.id, result.error || "Ошибка отмены");
    }
    return;
  }

  // ---- RESCHEDULE BOOKING ----
  if (data.startsWith("reschedule_")) {
    const bookingId = data.replace("reschedule_", "");

    // Cancel old booking
    await cancelBooking(bookingId, telegramId);

    await answerCallbackQuery(botToken, callbackQuery.id, "Запись отменена для переноса");

    if (messageId) {
      await editMessageText(
        botToken, chatId, messageId,
        "📅 Предыдущая запись отменена.\n\nНапишите мне новую дату и время, и я запишу вас заново!"
      );
    }
    return;
  }

  // ---- RATE BOOKING ----
  if (data.startsWith("rate_")) {
    const parts = data.split("_"); // rate_bookingId_rating
    const bookingId = parts[1];
    const rating = parseInt(parts[2]);

    if (rating >= 1 && rating <= 5) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (booking) {
        // Save review draft (without comment yet)
        await prisma.review.create({
          data: {
            rating,
            clientTelegramId: telegramId,
            clientName: booking.clientName,
            bookingId: booking.id,
            businessId,
          },
        });
      }

      const stars = "⭐".repeat(rating);
      await answerCallbackQuery(botToken, callbackQuery.id, `Спасибо за оценку: ${stars}`);

      if (messageId) {
        // Always ask for a text comment regardless of rating
        const prompt = rating >= 4
          ? `Спасибо за оценку ${stars}! Мы очень рады! 💜\n\nРасскажите подробнее — что понравилось больше всего? Ваш отзыв поможет нам стать ещё лучше:`
          : `Спасибо за оценку ${stars}.\n\nНам очень важно понять, что пошло не так. Пожалуйста, расскажите подробнее:`;
        await editMessageText(botToken, chatId, messageId, prompt);
      }
    }
    return;
  }

  // ---- UNSUBSCRIBE ----
  if (data.startsWith("unsubscribe_")) {
    const clientId = data.replace("unsubscribe_", "");

    await prisma.client.update({
      where: { id: clientId },
      data: { isBlocked: true },
    });

    await answerCallbackQuery(botToken, callbackQuery.id, "Вы отписаны от рассылок");
    if (messageId) {
      await editMessageText(
        botToken, chatId, messageId,
        "Вы отписаны от рассылок. Если захотите снова получать сообщения — просто напишите нам!"
      );
    }
    return;
  }

  // ---- BOOK NEW (from reactivation) ----
  if (data === "book_new" || data.startsWith("book_promo_")) {
    await answerCallbackQuery(botToken, callbackQuery.id);
    await sendTelegramMessage(
      botToken, chatId,
      "Отлично! На какую дату и время вы хотите записаться? Напишите, и я подберу свободное время! 📅"
    );
    return;
  }

  // Unknown callback — just acknowledge
  await answerCallbackQuery(botToken, callbackQuery.id);
}

// ========================================
// WEBHOOK HANDLER
// ========================================

export async function POST(request: NextRequest) {
  try {
    // Получаем параметры из URL
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const legacyToken = searchParams.get("token"); // Legacy support

    let business: { id: string; name: string; botToken: string } | null = null;
    let botToken: string | null = null;

    if (businessId) {
      // New method: find by businessId
      const foundBusiness = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, botToken: true },
      });
      if (foundBusiness?.botToken) {
        business = { id: foundBusiness.id, name: foundBusiness.name, botToken: foundBusiness.botToken };
        botToken = foundBusiness.botToken;
      }
    } else if (legacyToken) {
      // Legacy method: find by token
      const foundBusiness = await findBusinessByBotToken(legacyToken);
      if (foundBusiness) {
        const fullBusiness = await prisma.business.findUnique({
          where: { id: foundBusiness.id },
          select: { id: true, name: true, botToken: true },
        });
        if (fullBusiness?.botToken) {
          business = { id: fullBusiness.id, name: fullBusiness.name, botToken: fullBusiness.botToken };
          botToken = fullBusiness.botToken;
        }
      }
    }

    if (!business || !botToken) {
      return NextResponse.json({ error: "Invalid business or token" }, { status: 401 });
    }

    const update: TelegramUpdate = await request.json();

    // Обработка нажатий на inline-кнопки
    if (update.callback_query) {
      await handleCallbackQuery(botToken, business.id, update.callback_query);
      return NextResponse.json({ ok: true });
    }

    // Обрабатываем только текстовые сообщения
    if (!update.message?.text && !update.message?.contact) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    const telegramId = BigInt(message.from.id);
    const userMessage = message.text || "";
    const userName =
      message.from.first_name +
      (message.from.last_name ? ` ${message.from.last_name}` : "");

    // Обработка контакта (если пользователь поделился номером)
    if (message.contact) {
      const phone = message.contact.phone_number;
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
          phone,
          name: message.contact.first_name,
        },
        update: {
          phone,
          name: message.contact.first_name,
        },
      });

      await sendTelegramMessage(
        botToken,
        chatId,
        `Спасибо! Ваш номер ${phone} сохранён. Чем могу помочь?`
      );
      return NextResponse.json({ ok: true });
    }

    // Команда /start
    if (userMessage === "/start") {
      const senderUsername = message.from.username?.toLowerCase().replace("@", "") || "";

      // Проверяем: это мастер подключается к уведомлениям?
      if (senderUsername) {
        // Ищем среди всех мастеров этого бизнеса
        const allStaff = await prisma.staff.findMany({
          where: { businessId: business.id, telegramUsername: { not: null } },
          select: { id: true, name: true, telegramUsername: true },
        });

        const matchedStaff = allStaff.find(
          (s) => s.telegramUsername?.toLowerCase().replace("@", "") === senderUsername
        );

        if (matchedStaff) {
          await prisma.staff.update({
            where: { id: matchedStaff.id },
            data: { telegramChatId: BigInt(chatId) },
          });

          await sendTelegramMessage(
            botToken,
            chatId,
            `✅ ${matchedStaff.name}, вы подключены к уведомлениям!\n\nТеперь вы будете получать новые записи клиентов сюда.`
          );
          return NextResponse.json({ ok: true });
        }

        // Проверяем: это владелец подключается?
        const businessData = await prisma.business.findUnique({
          where: { id: business.id },
          select: { ownerTelegramUsername: true, name: true, welcomeMessage: true },
        });

        const ownerUsername = businessData?.ownerTelegramUsername?.toLowerCase().replace("@", "") || "";
        if (ownerUsername && ownerUsername === senderUsername) {
          await prisma.business.update({
            where: { id: business.id },
            data: { ownerTelegramChatId: BigInt(chatId) },
          });

          await sendTelegramMessage(
            botToken,
            chatId,
            `✅ Вы подключены как администратор!\n\nВсе уведомления о записях, отменах и новых клиентах будут приходить сюда.`
          );
          return NextResponse.json({ ok: true });
        }

        // Обычный клиент — показываем приветствие
        const welcomeMsg =
          businessData?.welcomeMessage ||
          `Здравствуйте! 👋 Добро пожаловать в ${businessData?.name || "нашу компанию"}!\n\nЯ AI-помощник и готов ответить на ваши вопросы о наших услугах, ценах и помочь с записью.\n\nЧем могу помочь?`;

        await sendTelegramMessage(botToken, chatId, welcomeMsg);
        return NextResponse.json({ ok: true });
      }

      // Нет username — обычный клиент
      const businessData = await prisma.business.findUnique({
        where: { id: business.id },
        select: { welcomeMessage: true, name: true },
      });

      const welcomeMsg =
        businessData?.welcomeMessage ||
        `Здравствуйте! 👋 Добро пожаловать в ${businessData?.name || "нашу компанию"}!\n\nЯ AI-помощник и готов ответить на ваши вопросы о наших услугах, ценах и помочь с записью.\n\nЧем могу помочь?`;

      await sendTelegramMessage(botToken, chatId, welcomeMsg);
      return NextResponse.json({ ok: true });
    }

    // ---- PENDING REVIEW COMMENT ----
    // Check if user recently rated (review without comment in last 15 min)
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
        // Save the comment
        await prisma.review.update({
          where: { id: pendingReview.id },
          data: { comment: userMessage as string },
        });

        // Fetch settings and owner info in parallel
        const [bizSettings, bizOwner] = await Promise.all([
          prisma.automationSettings.findUnique({ where: { businessId: business.id } }),
          prisma.business.findUnique({
            where: { id: business.id },
            select: { ownerTelegramChatId: true },
          }),
        ]);

        if (pendingReview.rating >= 4) {
          // High rating — ask to post publicly
          const buttons: { text: string; url: string }[] = [];
          if (bizSettings?.reviewGoogleLink) {
            buttons.push({ text: "📝 Google Maps", url: bizSettings.reviewGoogleLink! });
          }
          if (bizSettings?.review2gisLink) {
            buttons.push({ text: "📝 2GIS", url: bizSettings.review2gisLink! });
          }
          const yandexLink = (bizSettings as Record<string, unknown>)?.reviewYandexLink as string | null | undefined;
          if (yandexLink) {
            buttons.push({ text: "📝 Яндекс.Карты", url: yandexLink });
          }

          const replyText = `Спасибо за ваш отзыв! 💜\n\nЕсли хотите помочь нам — поделитесь мнением на одной из платформ. Это займёт 1 минуту и очень поможет нашему бизнесу! 🙏`;

          if (buttons.length > 0) {
            await sendTelegramMessageWithButtons(botToken, chatId, replyText, [buttons]);
          } else {
            await sendTelegramMessage(botToken, chatId, replyText);
          }
        } else if (pendingReview.rating <= 2) {
          // Low rating — empathy + notify owner
          await sendTelegramMessage(
            botToken, chatId,
            `Спасибо, что рассказали нам об этом. 🙏\n\nМы обязательно разберёмся с ситуацией и свяжемся с вами, если потребуется. Нам важно, чтобы каждый визит был на высшем уровне.`
          );

          // Notify business owner
          const ownerChatId = bizOwner?.ownerTelegramChatId;
          if (ownerChatId) {
            const stars = "⭐".repeat(pendingReview.rating);
            const bookingInfo = pendingReview.bookingId
              ? ` (запись #${pendingReview.bookingId.slice(-6)})`
              : "";
            await sendTelegramMessage(
              botToken,
              Number(ownerChatId),
              `⚠️ Низкая оценка от клиента!\n\nКлиент: ${pendingReview.clientName || "Неизвестен"}\nОценка: ${stars}\nКомментарий: "${userMessage}"${bookingInfo}\n\nРекомендуем связаться с клиентом и разобрать ситуацию.`
            );
          }
        } else {
          // 3 stars — neutral
          await sendTelegramMessage(
            botToken, chatId,
            `Спасибо за честный отзыв! 🙏 Мы всегда стараемся стать лучше.`
          );
        }

        return NextResponse.json({ ok: true });
      }
    }

    // Проверяем лимит сообщений
    const { allowed, plan } = await checkMessageLimit(business.id);

    if (!allowed) {
      let errorMsg =
        "К сожалению, лимит сообщений исчерпан. Пожалуйста, обратитесь к администратору.";

      if (plan === "none") {
        errorMsg =
          "Бот временно недоступен. Пожалуйста, свяжитесь с нами напрямую.";
      }

      await sendTelegramMessage(botToken, chatId, errorMsg);
      return NextResponse.json({ ok: true });
    }

    // Показываем "печатает..."
    await sendTypingAction(botToken, chatId);

    // Генерируем ответ AI с учётом памяти
    const aiResponse = await generateAIResponse(
      business.id,
      telegramId,
      userMessage,
      userName
    );

    // Отправляем ответ
    await sendTelegramMessage(botToken, chatId, aiResponse);

    // Увеличиваем счётчик использованных сообщений
    await incrementMessageUsage(business.id);

    // Обновляем статистику бизнеса
    await prisma.business.update({
      where: { id: business.id },
      data: { totalConversations: { increment: 1 } },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true }); // Всегда 200 для Telegram
  }
}

// Для проверки webhook
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Staffix Business Bot Webhook with AI Memory",
    version: "1.0",
  });
}
