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
    const messages = [
      ...conversation.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    // Ограничиваем контекст (последние 20 сообщений)
    const recentMessages = messages.slice(-20);

    // 6. Вызываем Claude API
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: recentMessages,
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Извините, не могу обработать ваш запрос.";

    // 7. Сохраняем сообщения в базу
    await saveMessage(conversation.id, "user", userMessage);
    await saveMessage(conversation.id, "assistant", assistantMessage);

    // 8. Обновляем счётчик сообщений в разговоре
    await updateConversationMessageCount(conversation.id);

    // 9. Извлекаем и сохраняем информацию о клиенте
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
// WEBHOOK HANDLER
// ========================================

export async function POST(request: NextRequest) {
  try {
    // Получаем токен бота из URL параметра
    const { searchParams } = new URL(request.url);
    const botToken = searchParams.get("token");

    if (!botToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 400 });
    }

    // Находим бизнес по токену
    const business = await findBusinessByBotToken(botToken);
    if (!business) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const update: TelegramUpdate = await request.json();

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
      // Загружаем приветственное сообщение бизнеса
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

    // Проверяем лимит сообщений
    const { allowed, remaining, plan } = await checkMessageLimit(business.id);

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
