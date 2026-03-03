/**
 * Main Telegram Bot Webhook for Business AI Employees
 * Интеграция с AI Memory System (Фаза 1)
 */

// Vercel Pro: allow up to 300 seconds for AI processing
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
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
  updateLeadStatus,
} from "@/lib/booking-tools";
import { sendBookingNotification } from "@/lib/notifications";
import { formatDateRu } from "@/lib/automation";
import { dispatchCrmEvent } from "@/lib/crm-integrations";
import { salesToolDefinitions, executeSalesTool, notifyManagerByTelegram } from "@/lib/sales-tools";
import { buildSalesSystemPrompt, isSalesMode } from "@/lib/sales-prompt";
import { markWebhookProcessed } from "@/lib/webhook-dedup";

// ========================================
// HELPERS
// ========================================

function getDefaultWelcome(name?: string | null, lang?: string | null): string {
  const biz = name || "нашу компанию";
  if (lang === "en") return `Hello! 👋 Welcome to ${biz}!\n\nI'm an AI assistant ready to answer your questions about our services, prices, and help with bookings.\n\nHow can I help you?\n\n💡 /lang — change language`;
  if (lang === "uz") return `Salom! 👋 ${biz}ga xush kelibsiz!\n\nMen AI yordamchiman — xizmatlar, narxlar haqida savollarga javob beraman va yozilishga yordam beraman.\n\nQanday yordam bera olaman?\n\n💡 /lang — tilni o'zgartirish`;
  return `Здравствуйте! 👋 Добро пожаловать в ${biz}!\n\nЯ AI-помощник и готов ответить на ваши вопросы о наших услугах, ценах и помочь с записью.\n\nЧем могу помочь?\n\n💡 /lang — сменить язык`;
}

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
    // Telegram limit is 4096 chars — split if needed
    const chunks = text.length > 4096 ? splitTelegramMessage(text) : [text];
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
            parse_mode: "HTML",
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

function splitTelegramMessage(text: string, maxLen = 4096): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    // Try to split at last newline before limit
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.3) splitAt = maxLen; // no good newline found
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
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

    // Increment totalConversations only when a NEW conversation is created
    prisma.business.update({
      where: { id: businessId },
      data: { totalConversations: { increment: 1 } },
    }).catch(e => console.error("[Webhook] totalConversations increment error:", e));

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
        // Dispatch CRM event (non-blocking)
        if (result.success && result.bookingId) {
          dispatchCrmEvent(businessId, "booking_created", {
            client: {
              name: toolInput.client_name || null,
              phone: toolInput.client_phone || null,
              telegramId: String(telegramId),
              totalVisits: 0,
              tags: [],
            },
            booking: {
              id: result.bookingId,
              service: result.details?.serviceName || null,
              master: result.details?.staffName || null,
              date: `${toolInput.date}T${toolInput.time}:00Z`,
              price: null,
              status: "confirmed",
              clientName: toolInput.client_name || "",
              clientPhone: toolInput.client_phone || null,
            },
          }).catch(() => {});
        }
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
        // Dispatch CRM event (non-blocking)
        if (result.success) {
          dispatchCrmEvent(businessId, "booking_cancelled", {
            client: {
              name: null,
              phone: null,
              telegramId: String(telegramId),
              totalVisits: 0,
              tags: [],
            },
            booking: {
              id: toolInput.booking_id,
              service: null,
              master: null,
              date: new Date().toISOString(),
              price: null,
              status: "cancelled",
              clientName: "",
              clientPhone: null,
            },
          }).catch(() => {});
        }
        return JSON.stringify(result);
      }

      case "notify_manager": {
        const result = await notifyManagerByTelegram(
          businessId,
          telegramId,
          toolInput.reason,
          toolInput.client_name,
          toolInput.urgency
        );
        return JSON.stringify(result);
      }

      case "update_lead_status": {
        const result = await updateLeadStatus(
          businessId,
          telegramId.toString(),
          "telegram",
          toolInput.status,
          toolInput.reason
        );
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFallbackFromToolResults(toolResults: any[], salesMode: boolean): string {
  for (const tr of toolResults) {
    try {
      const parsed = JSON.parse(tr.content);
      if (!parsed.success) continue;

      // Order confirmation (sales mode)
      if (parsed.orderNumber && parsed.totalPrice !== undefined) {
        const items = parsed.summary || parsed.items?.map((i: { name: string; quantity: number }) => `${i.name} × ${i.quantity}`).join(", ") || "";
        return `Заказ ${parsed.orderNumber} оформлен! 🎉\n\n${items}\nИтого: ${parsed.totalPrice.toLocaleString()} ₸\n\nСпасибо за покупку! Мы скоро свяжемся с вами.`;
      }

      // Booking confirmation (service mode)
      if (parsed.details) {
        const d = parsed.details;
        if (d.serviceName && d.staffName) {
          return `Запись создана! ✅\n\n${d.serviceName} к мастеру ${d.staffName}\n📅 ${d.date} в ${d.time}\n\nЖдём вас!`;
        }
      }

      // Generic success with message
      if (parsed.message) {
        return parsed.message;
      }
    } catch { /* not JSON */ }
  }
  return salesMode
    ? "Ваш запрос обработан! Если есть вопросы — напишите."
    : "Готово! Чем ещё могу помочь?";
}

async function generateAIResponse(
  businessId: string,
  telegramId: bigint,
  userMessage: string,
  userName: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("[Webhook] ANTHROPIC_API_KEY is not set!");
    return "Извините, сервис временно недоступен. Попробуйте позже.";
  }

  try {
    // 1. Загружаем контекст бизнеса
    console.log(`[Webhook] Building business context for ${businessId}...`);
    const businessContext = await buildBusinessContext(businessId);
    if (!businessContext) {
      console.error(`[Webhook] buildBusinessContext returned null for ${businessId}`);
      return "Извините, произошла ошибка. Попробуйте позже.";
    }
    console.log(`[Webhook] Business context loaded: ${businessContext.name}`);

    // 2. Загружаем контекст клиента (AI Memory!)
    console.log(`[Webhook] Building client context for telegramId=${telegramId}...`);
    const clientContext = await buildClientContext(businessId, telegramId);
    console.log(`[Webhook] Client context: ${clientContext ? 'loaded' : 'null (new client)'}`);

    // 3. Определяем режим бота: продажи или запись
    const salesMode = isSalesMode(businessContext.businessType, businessContext.dashboardMode);
    console.log(`[Webhook] Mode: ${salesMode ? 'sales' : 'service'}, type=${businessContext.businessType}`);

    // 4. Строим системный промпт
    let systemPrompt: string;
    if (salesMode) {
      // Режим магазина: продажи, заказы, товары
      const salesClientCtx = clientContext
        ? {
            name: clientContext.name,
            totalOrders: clientContext.totalVisits, // используем totalVisits как счётчик заказов
            lastOrderDate: clientContext.lastVisitDate,
            tags: clientContext.tags,
            importantNotes: clientContext.importantNotes,
          }
        : null;

      // Load product categories and knowledge base documents for sales prompt
      const { getAvailableCategories } = await import("@/lib/sales-tools");
      const categories = await getAvailableCategories(businessId);
      const totalProducts = await prisma.product.count({ where: { businessId, isActive: true } });
      const documents = await prisma.document.findMany({
        where: { businessId, parsed: true },
        select: { name: true, extractedText: true },
      });

      systemPrompt = buildSalesSystemPrompt(
        {
          name: businessContext.name,
          businessType: businessContext.businessType,
          phone: businessContext.phone,
          address: businessContext.address,
          workingHours: businessContext.workingHours,
          welcomeMessage: businessContext.welcomeMessage,
          aiTone: businessContext.aiTone,
          aiRules: businessContext.aiRules,
          language: businessContext.language || "ru",
          categories,
          totalProducts,
          documents,
        },
        salesClientCtx
      );
    } else {
      // Режим сервисного бизнеса: запись к мастеру
      systemPrompt = buildSystemPrompt(businessContext, clientContext);
    }

    // 5. Получаем историю разговора
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

    // Выбираем tools в зависимости от режима
    const activeTools = salesMode ? salesToolDefinitions : bookingToolDefinitions;

    // Сегодняшняя дата для контекста
    const today = new Date().toISOString().split("T")[0];
    const systemHint = salesMode
      ? `\n\nСегодня: ${today}. Используй инструменты для поиска товаров и оформления заказов.`
      : `\n\nСегодняшняя дата: ${today}. Используй инструменты для работы с записями.`;
    const systemWithDate = systemPrompt + systemHint;

    console.log(`[Webhook] Calling Claude API for business=${businessId}, salesMode=${salesMode}`);
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemWithDate,
      messages: recentMessages,
      tools: activeTools,
    });
    console.log(`[Webhook] Claude response: stop_reason=${response.stop_reason}`);

    // 7. Обрабатываем tool_use в цикле (до 5 итераций)
    let iterations = 0;
    const maxIterations = 5;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastToolResults: any[] = [];

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
          console.log(`[Webhook] Tool call: ${block.name}`);
          // Роутим к нужному диспетчеру в зависимости от режима
          const result = salesMode
            ? await executeSalesTool(
                block.name,
                block.input as Record<string, unknown>,
                businessId,
                telegramId
              )
            : await handleToolCall(
                block.name,
                block.input as Record<string, string>,
                businessId,
                telegramId
              );

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      lastToolResults = toolResults;

      // Добавляем результаты tool в messages
      recentMessages.push({
        role: "user",
        content: toolResults,
      });

      // Вызываем Claude снова с результатами
      try {
        response = await anthropic.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          system: systemWithDate,
          messages: recentMessages,
          tools: activeTools,
        });
      } catch (apiError) {
        // If API fails after successful tool execution, build response from tool results
        console.error("[Webhook] API error after tool execution:", apiError);
        return buildFallbackFromToolResults(lastToolResults, salesMode);
      }
    }

    // 8. Извлекаем финальный текстовый ответ
    const textBlocks = response.content.filter((block) => block.type === "text");
    let assistantMessage: string;
    if (textBlocks.length > 0 && textBlocks[0].type === "text") {
      assistantMessage = textBlocks[0].text;
    } else if (lastToolResults.length > 0) {
      // Claude returned only tool_use without text — extract info from tool results
      console.log("[Webhook] No text blocks in response, building from tool results");
      assistantMessage = buildFallbackFromToolResults(lastToolResults, salesMode);
    } else {
      assistantMessage = "Чем ещё могу помочь?";
    }

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
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    console.error(`[Webhook] generateAIResponse FAILED: ${errMsg}\n${errStack}`);
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

  // ---- SET LANGUAGE (from /lang command) ----
  if (data.startsWith("set_lang:")) {
    const lang = data.replace("set_lang:", "");
    const langNames: Record<string, string> = { ru: "Русский", en: "English", uz: "O'zbek", kz: "Қазақша" };

    // Save preferred language to client record
    try {
      await prisma.client.updateMany({
        where: { businessId, telegramId },
        data: { importantNotes: `Preferred language: ${lang}` },
      });
    } catch {}

    await answerCallbackQuery(botToken, callbackQuery.id, langNames[lang] || lang);
    if (messageId) {
      const confirmMsg: Record<string, string> = {
        ru: "✅ Язык установлен: Русский. Теперь я буду отвечать на русском!",
        en: "✅ Language set: English. I'll respond in English from now on!",
        uz: "✅ Til tanlandi: O'zbek. Endi men o'zbek tilida javob beraman!",
        kz: "✅ Тіл таңдалды: Қазақша. Енді мен қазақ тілінде жауап беремін!",
      };
      await editMessageText(botToken, chatId, messageId, confirmMsg[lang] || confirmMsg.ru);
    }
    return;
  }

  // Unknown callback — just acknowledge
  await answerCallbackQuery(botToken, callbackQuery.id);
}

// ========================================
// WEBHOOK HANDLER
// ========================================

export async function POST(request: NextRequest) {
  // These are set as early as possible so the catch can send a fallback message
  let catchBotToken: string | null = null;
  let catchChatId: number | null = null;

  try {
    // Получаем параметры из URL
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const legacyToken = searchParams.get("token"); // Legacy support

    let business: { id: string; name: string; botToken: string; webhookSecret: string | null } | null = null;
    let botToken: string | null = null;

    if (businessId) {
      // New method: find by businessId
      const foundBusiness = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, botToken: true, webhookSecret: true },
      });
      if (foundBusiness?.botToken) {
        business = { id: foundBusiness.id, name: foundBusiness.name, botToken: foundBusiness.botToken, webhookSecret: foundBusiness.webhookSecret };
        botToken = foundBusiness.botToken;
      }
    } else if (legacyToken) {
      // Legacy method: find by token
      const foundBusiness = await findBusinessByBotToken(legacyToken);
      if (foundBusiness) {
        const fullBusiness = await prisma.business.findUnique({
          where: { id: foundBusiness.id },
          select: { id: true, name: true, botToken: true, webhookSecret: true },
        });
        if (fullBusiness?.botToken) {
          business = { id: fullBusiness.id, name: fullBusiness.name, botToken: fullBusiness.botToken, webhookSecret: fullBusiness.webhookSecret };
          botToken = fullBusiness.botToken;
        }
      }
    }

    if (!business || !botToken) {
      return NextResponse.json({ error: "Invalid business or token" }, { status: 401 });
    }

    catchBotToken = botToken; // Save for error fallback

    // Rate limiting: 30 сообщений в минуту на бизнес (защита от flood)
    const rlResult = await rateLimit(`tg-webhook:${business.id}`, 30, 1);
    if (!rlResult.allowed) {
      return NextResponse.json({ ok: true }); // Telegram ожидает 200, даже при отклонении
    }

    // Читаем тело один раз
    const rawBody = await request.text();

    // Верификация secret_token (Telegram шлёт его as-is в хедере X-Telegram-Bot-Api-Secret-Token)
    if (business.webhookSecret) {
      const receivedToken = request.headers.get("x-telegram-bot-api-secret-token");
      if (!receivedToken || receivedToken !== business.webhookSecret) {
        console.error(`Telegram webhook: invalid secret_token for businessId=${businessId}`);
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }

    const update: TelegramUpdate = JSON.parse(rawBody);

    // Skip duplicate webhook deliveries
    const dedupId = `tg-${update.update_id}`;
    if (!(await markWebhookProcessed(dedupId))) {
      return NextResponse.json({ ok: true });
    }

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
    catchChatId = chatId; // Save for error fallback
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
          select: { ownerTelegramUsername: true, name: true, welcomeMessage: true, language: true },
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
          getDefaultWelcome(businessData?.name, businessData?.language);

        await sendTelegramMessage(botToken, chatId, welcomeMsg);
        return NextResponse.json({ ok: true });
      }

      // Нет username — обычный клиент
      const businessData = await prisma.business.findUnique({
        where: { id: business.id },
        select: { welcomeMessage: true, name: true, language: true },
      });

      const welcomeMsg =
        businessData?.welcomeMessage ||
        getDefaultWelcome(businessData?.name, businessData?.language);

      await sendTelegramMessage(botToken, chatId, welcomeMsg);
      return NextResponse.json({ ok: true });
    }

    // Команда /lang — выбор языка клиентом
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
        } else {
          // 3 stars or less — empathy + notify owner
          const clientMsg = pendingReview.rating <= 2
            ? `Спасибо, что рассказали нам об этом. 🙏\n\nМы обязательно разберёмся с ситуацией и свяжемся с вами, если потребуется. Нам важно, чтобы каждый визит был на высшем уровне.`
            : `Спасибо за честный отзыв! 🙏\n\nМы всегда стремимся стать лучше и обязательно обратим внимание на ваши слова.`;
          await sendTelegramMessage(botToken, chatId, clientMsg);

          // Notify business owner
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
    console.log(`[Webhook] Generating AI response for business=${business.id}, msg="${userMessage.slice(0, 50)}..."`);
    const aiResponse = await generateAIResponse(
      business.id,
      telegramId,
      userMessage,
      userName
    );
    console.log(`[Webhook] AI response generated (${aiResponse.length} chars)`);

    // Отправляем ответ
    await sendTelegramMessage(botToken, chatId, aiResponse);

    // Увеличиваем счётчик использованных сообщений (не блокируем ответ)
    // Note: totalConversations is now incremented in getOrCreateConversation only for NEW conversations
    incrementMessageUsage(business.id).catch(e => console.error("[Webhook] incrementMessageUsage error:", e));

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Webhook] TOP-LEVEL ERROR: ${errMsg}`, error);
    // Try to inform the user rather than silently failing
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
        // ignore send error
      }
    }
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
