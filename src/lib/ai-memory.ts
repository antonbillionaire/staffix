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
  loyaltyPoints: number;
  loyaltyVisits: number;
  loyaltyTotalSpent: number;
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
  businessTypes: string[];
  industryCategory: string | null;
  language: string;
  phone: string | null;
  address: string | null;
  workingHours: string | null;
  welcomeMessage: string | null;
  aiTone: string | null;
  aiRules: string | null;
  deliveryEnabled: boolean;
  deliveryTimeFrom: number | null;
  deliveryTimeTo: number | null;
  deliveryFee: number | null;
  deliveryFreeFrom: number | null;
  deliveryZones: string | null;
  services: Array<{ name: string; price: number; duration: number }>;
  staff: Array<{ name: string; role: string | null }>;
  faqs: Array<{ question: string; answer: string }>;
  documents: Array<{ name: string; extractedText: string | null }>;
  loyalty: {
    enabled: boolean;
    type: string;
    cashbackPercent: number | null;
    visitsForReward: number | null;
    rewardType: string | null;
    rewardDiscount: number | null;
  } | null;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loyaltyPoints: (client as any).loyaltyPoints ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loyaltyVisits: (client as any).loyaltyVisits ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loyaltyTotalSpent: (client as any).loyaltyTotalSpent ?? 0,
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
    // Try with loyaltyProgram, fallback without if table doesn't exist yet
    let business;
    try {
      business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          services: { select: { name: true, price: true, duration: true } },
          staff: { select: { name: true, role: true } },
          faqs: { select: { question: true, answer: true } },
          documents: {
            where: { parsed: true },
            select: { name: true, extractedText: true }
          },
          loyaltyProgram: {
            select: { enabled: true, type: true, cashbackPercent: true, visitsForReward: true, rewardType: true, rewardDiscount: true }
          },
        },
      });
    } catch {
      // Fallback: loyaltyProgram table may not exist yet
      console.log("buildBusinessContext: loyaltyProgram query failed, retrying without it");
      business = await prisma.business.findUnique({
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
    }

    if (!business) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const biz = business as any;

    return {
      name: business.name,
      businessType: business.businessType,
      businessTypes: biz.businessTypes || [],
      industryCategory: business.industryCategory,
      language: business.language || "ru",
      phone: business.phone,
      address: business.address,
      workingHours: business.workingHours,
      welcomeMessage: business.welcomeMessage,
      aiTone: business.aiTone,
      aiRules: business.aiRules,
      deliveryEnabled: biz.deliveryEnabled ?? false,
      deliveryTimeFrom: biz.deliveryTimeFrom ?? null,
      deliveryTimeTo: biz.deliveryTimeTo ?? null,
      deliveryFee: biz.deliveryFee ?? null,
      deliveryFreeFrom: biz.deliveryFreeFrom ?? null,
      deliveryZones: biz.deliveryZones ?? null,
      services: business.services,
      staff: business.staff,
      faqs: business.faqs,
      documents: business.documents,
      loyalty: biz.loyaltyProgram ? {
        enabled: biz.loyaltyProgram.enabled,
        type: biz.loyaltyProgram.type,
        cashbackPercent: biz.loyaltyProgram.cashbackPercent,
        visitsForReward: biz.loyaltyProgram.visitsForReward,
        rewardType: biz.loyaltyProgram.rewardType,
        rewardDiscount: biz.loyaltyProgram.rewardDiscount,
      } : null,
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

  // Language instruction for AI
  const langMap: Record<string, string> = {
    ru: "Отвечай на русском языке.",
    en: "Respond in English.",
    uz: "O'zbek tilida javob ber. (Respond in Uzbek)",
    kz: "Қазақ тілінде жауап бер. (Respond in Kazakh)",
    kg: "Кыргыз тилинде жооп бер. (Respond in Kyrgyz)",
    tj: "Бо забони тоҷикӣ ҷавоб деҳ. (Respond in Tajik)",
    am: "Հայերեն պատdelays. (Respond in Armenian)",
    ge: "უპასუხე ქართულად. (Respond in Georgian)",
  };
  const langInstruction = langMap[business.language] || langMap.ru;

  const businessTypeLabel = business.businessTypes.length > 0
    ? business.businessTypes.join(", ")
    : business.businessType || "не указан";

  let prompt = `Ты — AI-сотрудник компании "${business.name}".

## Язык общения:
${langInstruction}
Если клиент пишет на другом языке — отвечай на языке клиента.

## О компании:
- Тип бизнеса: ${businessTypeLabel}
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

${business.deliveryEnabled ? `## Доставка:
- Время доставки: ${business.deliveryTimeFrom && business.deliveryTimeTo ? `${business.deliveryTimeFrom}–${business.deliveryTimeTo} минут` : "уточняйте"}
${business.deliveryFee ? `- Стоимость доставки: ${business.deliveryFee}` : "- Доставка бесплатная"}
${business.deliveryFreeFrom ? `- Бесплатная доставка от суммы: ${business.deliveryFreeFrom}` : ""}
${business.deliveryZones ? `- Зоны: ${business.deliveryZones}` : ""}
` : ""}
${business.loyalty?.enabled ? `## Программа лояльности:
${business.loyalty.type === "cashback" ? `- Тип: Кэшбэк ${business.loyalty.cashbackPercent}% от суммы заказа
- Клиент накапливает бонусные баллы и может оплатить ими часть заказа` : ""}${business.loyalty.type === "visits" ? `- Тип: По визитам — каждый ${business.loyalty.visitsForReward}-й визит ${business.loyalty.rewardType === "free" ? "бесплатно" : `со скидкой ${business.loyalty.rewardDiscount}%`}` : ""}${business.loyalty.type === "tiered" ? `- Тип: Уровни — скидка растёт с суммой покупок` : ""}
- Если клиент спрашивает о бонусах — расскажи о программе лояльности
` : ""}
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

## ПРОДАЮЩИЙ СТИЛЬ ОБЩЕНИЯ (применяй естественно, не навязчиво):

**1. Активное слушание.** Перефразируй запрос клиента своими словами, прежде чем ответить. Это показывает, что ты понял его правильно и создаёт доверие.

**2. Выявление потребности.** Если клиент пишет "хочу стрижку" — уточни детали: какой стиль, есть ли предпочтения по мастеру, к какому сроку нужно. Чем точнее потребность — тем легче её закрыть.

**3. Социальное доказательство.** Упоминай популярные услуги: "Наши клиенты чаще всего выбирают [услугу]". Если в FAQ или данных есть отзывы — используй их.

**4. Ценность перед ценой.** Сначала расскажи ЧТО получит клиент (результат, опыт мастера, качество), потом называй цену. Не начинай сразу с "стоит столько-то".

**5. Дефицит и срочность.** Если доступных слотов мало — мягко сообщи: "На эту неделю осталось пару свободных окошек, лучше забронировать заранее". Не выдумывай — говори это только если реально мало слотов из check_availability.

**6. Работа с возражениями по цене.** Если клиент говорит "дорого" — не извиняйся. Сравни: "За эту сумму вы получаете [конкретный результат + что входит]". Предложи услугу попроще если есть.

**7. Лестница согласия.** Получай маленькие "да" перед большим: сначала уточни предпочтения → потом предложи конкретный слот → потом спроси имя → потом создай запись. Не проси всё сразу.

**8. Будущая проекция.** Помоги клиенту представить результат: "После [услуги] вы будете выглядеть/чувствовать [результат]". Работает особенно хорошо для beauty-услуг.

**9. Перекрёстные продажи.** После того как клиент записался — предложи одну сопутствующую услугу: "Кстати, многие клиенты после [услуги] также берут [другую услугу] — удобно сделать за один визит". Не навязывай, предложи один раз.

**10. Реактивация постоянных клиентов.** Если клиент был у нас раньше — тепло обрати внимание: "Рады снова видеть вас! Как вам прошлый визит?". Это создаёт ощущение заботы и повышает лояльность.

**Чего НЕ делать:**
- Не давить и не торопить
- Не предлагать скидки без разрешения владельца (если не прописано в правилах)
- Не упоминать конкурентов
- Не обещать то, чего нет в прайсе или FAQ
`;

  // Добавляем данные нового клиента если это первый визит
  if (!client || client.totalVisits === 0) {
    prompt += `\n## СТРАТЕГИЯ ДЛЯ НОВОГО КЛИЕНТА:\nЭто новый клиент. Сначала поздоровайся и узнай его имя. Затем задай 1-2 вопроса чтобы понять потребность. Не вываливай весь прайс сразу — предложи наиболее подходящую услугу.`;
  }

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

    if (client.loyaltyPoints > 0) {
      prompt += `\n- Бонусные баллы: ${client.loyaltyPoints}`;
    }
    if (client.loyaltyVisits > 0) {
      prompt += `\n- Визитов (лояльность): ${client.loyaltyVisits}`;
    }
    if (client.loyaltyTotalSpent > 0) {
      prompt += `\n- Общая сумма покупок: ${client.loyaltyTotalSpent.toLocaleString()}`;
    }
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
      model: "claude-haiku-4-5-20251001", // Используем дешёвую модель для саммари
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
      model: "claude-haiku-4-5-20251001",
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
