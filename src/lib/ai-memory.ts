/**
 * AI Memory System for Staffix
 * Фаза 1: Умная память для клиентов и разговоров
 */

import { prisma } from "./prisma";
import Anthropic from "@anthropic-ai/sdk";

// ========================================
// ТИПЫ
// ========================================

interface ClientContext {
  clientId: string;
  name: string | null;
  phone: string | null;
  summary: string | null;
  preferences: Record<string, unknown> | null;
  importantNotes: string | null;
  totalVisits: number;
  totalMessages: number;
  lastVisitDate: Date | null;
  tags: string[];
  recentBookings: Array<{
    date: Date;
    serviceName: string | null;
    status: string;
  }>;
  conversationSummaries: string[];
}

interface BusinessContext {
  name: string;
  businessType: string | null;
  industryCategory: string | null;
  phone: string | null;
  address: string | null;
  workingHours: string | null;
  welcomeMessage: string | null;
  aiTone: string | null;
  aiRules: string | null;
  services: Array<{ name: string; price: number; duration: number }>;
  staff: Array<{ name: string; role: string | null }>;
  faqs: Array<{ question: string; answer: string }>;
  documents: Array<{ name: string; extractedText: string | null }>;
}

// ========================================
// ЗАГРУЗКА КОНТЕКСТА КЛИЕНТА
// ========================================

/**
 * Загружает полный контекст клиента для AI
 */
export async function buildClientContext(
  businessId: string,
  telegramId: bigint
): Promise<ClientContext | null> {
  try {
    // Находим или создаём клиента
    let client = await prisma.client.findUnique({
      where: {
        businessId_telegramId: {
          businessId,
          telegramId,
        },
      },
    });

    // Если клиент новый - создаём запись
    if (!client) {
      client = await prisma.client.create({
        data: {
          businessId,
          telegramId,
          totalMessages: 0,
          totalVisits: 0,
        },
      });
    }

    // Загружаем последние записи клиента
    const recentBookings = await prisma.booking.findMany({
      where: {
        businessId,
        clientTelegramId: telegramId,
      },
      orderBy: { date: "desc" },
      take: 5,
      include: {
        service: { select: { name: true } },
      },
    });

    // Загружаем последние разговоры с саммари
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId,
        clientTelegramId: telegramId,
        summary: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { summary: true },
    });

    return {
      clientId: client.id,
      name: client.name,
      phone: client.phone,
      summary: client.aiSummary,
      preferences: client.preferences as Record<string, unknown> | null,
      importantNotes: client.importantNotes,
      totalVisits: client.totalVisits,
      totalMessages: client.totalMessages,
      lastVisitDate: client.lastVisitDate,
      tags: client.tags,
      recentBookings: recentBookings.map((b) => ({
        date: b.date,
        serviceName: b.service?.name || null,
        status: b.status,
      })),
      conversationSummaries: conversations
        .map((c) => c.summary)
        .filter((s): s is string => s !== null),
    };
  } catch (error) {
    console.error("Error building client context:", error);
    return null;
  }
}

// ========================================
// ЗАГРУЗКА КОНТЕКСТА БИЗНЕСА
// ========================================

/**
 * Загружает контекст бизнеса для AI
 */
export async function buildBusinessContext(
  businessId: string
): Promise<BusinessContext | null> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: { select: { name: true, price: true, duration: true } },
        staff: { select: { name: true, role: true } },
        faqs: { select: { question: true, answer: true } },
        documents: {
          where: { parsed: true },
          select: { name: true, extractedText: true }
        },
      },
    });

    if (!business) return null;

    return {
      name: business.name,
      businessType: business.businessType,
      industryCategory: business.industryCategory,
      phone: business.phone,
      address: business.address,
      workingHours: business.workingHours,
      welcomeMessage: business.welcomeMessage,
      aiTone: business.aiTone,
      aiRules: business.aiRules,
      services: business.services,
      staff: business.staff,
      faqs: business.faqs,
      documents: business.documents,
    };
  } catch (error) {
    console.error("Error building business context:", error);
    return null;
  }
}

// ========================================
// ФОРМИРОВАНИЕ СИСТЕМНОГО ПРОМПТА
// ========================================

/**
 * Создаёт системный промпт с контекстом клиента и бизнеса
 */
export function buildSystemPrompt(
  business: BusinessContext,
  client: ClientContext | null
): string {
  const toneMap: Record<string, string> = {
    friendly: "Общайся дружелюбно и тепло, используй эмодзи умеренно.",
    professional: "Общайся профессионально и вежливо, без лишних эмоций.",
    casual: "Общайся неформально и легко, как с другом.",
  };

  let prompt = `Ты — AI-сотрудник компании "${business.name}".

## О компании:
- Тип бизнеса: ${business.businessType || "не указан"}
- Адрес: ${business.address || "не указан"}
- Телефон: ${business.phone || "не указан"}
- Часы работы: ${business.workingHours || "не указаны"}

## Услуги и цены:
${
  business.services.length > 0
    ? business.services
        .map((s) => `- ${s.name}: ${s.price} сум (${s.duration} мин)`)
        .join("\n")
    : "Услуги пока не добавлены в систему"
}

## Наши мастера/сотрудники:
${
  business.staff.length > 0
    ? business.staff
        .map((s) => `- ${s.name}${s.role ? ` (${s.role})` : ""}`)
        .join("\n")
    : "Сотрудники пока не добавлены"
}

## Частые вопросы (FAQ):
${
  business.faqs.length > 0
    ? business.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "FAQ пока не добавлены"
}

## Дополнительная информация из документов:
${
  business.documents.length > 0
    ? business.documents
        .filter((d) => d.extractedText)
        .map((d) => `### ${d.name}:\n${d.extractedText}`)
        .join("\n\n")
    : ""
}

## Стиль общения:
${toneMap[business.aiTone || "friendly"] || toneMap.friendly}

${business.aiRules ? `## Дополнительные правила:\n${business.aiRules}` : ""}

## Твои задачи:
1. Отвечать на вопросы клиентов о компании и услугах
2. Помогать с записью на услуги — используй инструменты для проверки свободных слотов и создания записей
3. Собирать контактные данные для записи (имя, телефон)
4. Если не можешь ответить — предложи связаться с администратором

## ВАЖНО — Работа с записями:
- Когда клиент хочет записаться — ОБЯЗАТЕЛЬНО используй инструмент check_availability чтобы проверить свободные слоты
- НЕ ВЫДУМЫВАЙ доступное время — только показывай реальные свободные слоты из инструмента
- Перед созданием записи уточни: услугу, дату, время и имя клиента
- После подтверждения клиентом — создай запись через create_booking
- Если клиент спрашивает о своих записях — используй get_my_bookings
- Предлагай только РЕАЛЬНО свободные слоты, не придумывай время
`;

  // Добавляем контекст клиента если есть
  if (client) {
    prompt += `\n\n## ИНФОРМАЦИЯ О КЛИЕНТЕ (используй для персонализации):`;

    if (client.name) {
      prompt += `\n- Имя: ${client.name}`;
    }

    if (client.totalVisits > 0) {
      prompt += `\n- Был у нас: ${client.totalVisits} раз(а)`;
    }

    if (client.lastVisitDate) {
      const lastVisit = new Date(client.lastVisitDate);
      prompt += `\n- Последний визит: ${lastVisit.toLocaleDateString("ru-RU")}`;
    }

    if (client.summary) {
      prompt += `\n- О клиенте: ${client.summary}`;
    }

    if (client.importantNotes) {
      prompt += `\n- ВАЖНО: ${client.importantNotes}`;
    }

    if (client.preferences) {
      const prefs = client.preferences;
      if (prefs.preferredServices) {
        prompt += `\n- Предпочитает: ${(prefs.preferredServices as string[]).join(", ")}`;
      }
    }

    if (client.recentBookings.length > 0) {
      prompt += `\n- Последние записи:`;
      for (const booking of client.recentBookings.slice(0, 3)) {
        const date = new Date(booking.date).toLocaleDateString("ru-RU");
        prompt += `\n  • ${date}: ${booking.serviceName || "услуга"} (${booking.status})`;
      }
    }

    if (client.conversationSummaries.length > 0) {
      prompt += `\n- Из прошлых разговоров:`;
      for (const summary of client.conversationSummaries) {
        prompt += `\n  • ${summary}`;
      }
    }

    if (client.tags.length > 0) {
      prompt += `\n- Теги: ${client.tags.join(", ")}`;
    }
  } else {
    prompt += `\n\n## КЛИЕНТ: Новый клиент, обращается впервые. Представься и узнай его имя.`;
  }

  return prompt;
}

// ========================================
// СОХРАНЕНИЕ ПОСЛЕ РАЗГОВОРА
// ========================================

/**
 * Обновляет информацию о клиенте после сообщения
 */
export async function updateClientAfterMessage(
  businessId: string,
  telegramId: bigint,
  clientName?: string
): Promise<void> {
  try {
    await prisma.client.upsert({
      where: {
        businessId_telegramId: {
          businessId,
          telegramId,
        },
      },
      create: {
        businessId,
        telegramId,
        name: clientName,
        totalMessages: 1,
        lastMessageAt: new Date(),
      },
      update: {
        name: clientName || undefined,
        totalMessages: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error updating client:", error);
  }
}

/**
 * Обновляет счётчик сообщений в разговоре и помечает для summarization
 */
export async function updateConversationMessageCount(
  conversationId: string
): Promise<boolean> {
  try {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: 1 },
      },
    });

    // Каждые 10 сообщений помечаем для создания summary
    if (conversation.messageCount % 10 === 0) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { needsSummary: true },
      });
      return true; // Нужен summary
    }

    return false;
  } catch (error) {
    console.error("Error updating conversation:", error);
    return false;
  }
}

// ========================================
// СОЗДАНИЕ САММАРИ (фоновая задача)
// ========================================

/**
 * Создаёт краткое содержание разговора с помощью AI
 */
export async function generateConversationSummary(
  conversationId: string
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20, // Последние 20 сообщений
        },
      },
    });

    if (!conversation || conversation.messages.length < 3) return null;

    const anthropic = new Anthropic({ apiKey });

    const messagesText = conversation.messages
      .map((m) => `${m.role === "user" ? "Клиент" : "AI"}: ${m.content}`)
      .join("\n");

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Используем дешёвую модель для саммари
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Кратко опиши этот разговор в 1-2 предложениях. Укажи:
- Что хотел клиент
- Какой результат (записался/получил ответ/не решено)
- Важные детали (если есть)

Разговор:
${messagesText}

Краткое содержание:`,
        },
      ],
    });

    const summary =
      response.content[0].type === "text" ? response.content[0].text : null;

    if (summary) {
      // Сохраняем summary
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          summary,
          needsSummary: false,
        },
      });
    }

    return summary;
  } catch (error) {
    console.error("Error generating conversation summary:", error);
    return null;
  }
}

/**
 * Обновляет AI-саммари клиента на основе всех разговоров
 */
export async function updateClientSummary(
  businessId: string,
  telegramId: bigint
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    // Получаем клиента и его данные
    const client = await prisma.client.findUnique({
      where: {
        businessId_telegramId: {
          businessId,
          telegramId,
        },
      },
    });

    if (!client) return null;

    // Получаем все саммари разговоров
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId,
        clientTelegramId: telegramId,
        summary: { not: null },
      },
      select: { summary: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    // Получаем записи
    const bookings = await prisma.booking.findMany({
      where: {
        businessId,
        clientTelegramId: telegramId,
      },
      include: { service: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 5,
    });

    if (conversations.length === 0 && bookings.length === 0) return null;

    const anthropic = new Anthropic({ apiKey });

    let contextText = "";

    if (conversations.length > 0) {
      contextText += "Разговоры с клиентом:\n";
      contextText += conversations.map((c) => `- ${c.summary}`).join("\n");
    }

    if (bookings.length > 0) {
      contextText += "\n\nЗаписи клиента:\n";
      contextText += bookings
        .map((b) => {
          const date = new Date(b.date).toLocaleDateString("ru-RU");
          return `- ${date}: ${b.service?.name || "услуга"} (${b.status})`;
        })
        .join("\n");
    }

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `На основе информации о клиенте, напиши краткое описание (1-2 предложения) для менеджера/AI.
Укажи: частоту визитов, предпочтения, особенности.

${contextText}

Краткое описание клиента:`,
        },
      ],
    });

    const summary =
      response.content[0].type === "text" ? response.content[0].text : null;

    if (summary) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          aiSummary: summary,
          summaryUpdatedAt: new Date(),
        },
      });
    }

    return summary;
  } catch (error) {
    console.error("Error updating client summary:", error);
    return null;
  }
}

// ========================================
// ИЗВЛЕЧЕНИЕ ИНФОРМАЦИИ ИЗ СООБЩЕНИЯ
// ========================================

/**
 * Извлекает имя клиента из сообщения (простая эвристика)
 */
export function extractClientName(message: string): string | null {
  // Паттерны для извлечения имени
  const patterns = [
    /(?:меня зовут|я\s+[-–—]?\s*|мое имя|меня|зовут)\s+([А-ЯЁа-яё]+)/i,
    /^([А-ЯЁ][а-яё]+)$/i, // Просто имя с большой буквы
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Проверяем что это похоже на имя (не слишком длинное, не число)
      if (name.length >= 2 && name.length <= 20 && !/\d/.test(name)) {
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      }
    }
  }

  return null;
}

/**
 * Извлекает телефон из сообщения
 */
export function extractPhone(message: string): string | null {
  // Убираем все кроме цифр и +
  const cleaned = message.replace(/[^\d+]/g, "");

  // Проверяем паттерны телефонов СНГ
  const patterns = [
    /^\+?(998|996|995|994|993|992|7|380|375)\d{9,10}$/, // Узбекистан, Кыргызстан, Грузия, Азербайджан, Туркменистан, Таджикистан, Россия/Казахстан, Украина, Беларусь
  ];

  for (const pattern of patterns) {
    if (pattern.test(cleaned)) {
      return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
    }
  }

  return null;
}
