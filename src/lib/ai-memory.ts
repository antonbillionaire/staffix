/**
 * AI Memory System for Staffix
 * Фаза 1: Умная память для клиентов и разговоров
 */

import { prisma } from "./prisma";
import Anthropic from "@anthropic-ai/sdk";

// ========================================
// HELPERS
// ========================================

const COUNTRY_CURRENCY: Record<string, string> = {
  UZ: "сум", KZ: "тенге", RU: "руб.", KG: "сом", TJ: "сомони",
  AM: "драм", GE: "лари", US: "$", GB: "£",
};
function currencyLabel(country?: string | null): string {
  return COUNTRY_CURRENCY[country || "UZ"] || "сум";
}

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
  botDisplayName: string | null;
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
  servicePackages: Array<{
    name: string;
    description: string | null;
    services: string[];
    regularPrice: number;
    finalPrice: number;
    savedAmount: number;
    autoSuggest: boolean;
  }>;
  serviceIncompatibilities: Array<{
    serviceA: string;
    serviceB: string;
    cooldownDays: number;
    bidirectional: boolean;
    reason: string | null;
  }>;
  staff: Array<{ id: string; name: string; role: string | null }>;
  faqs: Array<{ question: string; answer: string }>;
  documents: Array<{
    id: string;
    name: string;
    extractedText: string | null;
    description: string | null;
    autoDescription: string | null;
  }>;
  country: string;
  dashboardMode: string;
  consultationsEnabled: boolean;
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
    // Load business with all related data
    let business;
    try {
      business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          services: { select: { name: true, price: true, duration: true } },
          staff: { select: { id: true, name: true, role: true } },
          faqs: { select: { question: true, answer: true } },
          documents: {
            where: { parsed: true },
            select: {
              id: true,
              name: true,
              extractedText: true,
              description: true,
              autoDescription: true,
            }
          },
          loyaltyPrograms: {
            where: { enabled: true },
            select: { enabled: true, type: true, name: true, cashbackPercent: true, visitsForReward: true, rewardType: true, rewardDiscount: true }
          },
        },
      });
    } catch {
      // Fallback: loyaltyPrograms table may not exist yet
      console.log("buildBusinessContext: loyaltyPrograms query failed, retrying without it");
      business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          services: { select: { name: true, price: true, duration: true } },
          staff: { select: { id: true, name: true, role: true } },
          faqs: { select: { question: true, answer: true } },
          documents: {
            where: { parsed: true },
            select: {
              id: true,
              name: true,
              extractedText: true,
              description: true,
              autoDescription: true,
            }
          },
        },
      });
    }

    if (!business) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const biz = business as any;

    // Build loyalty info from all enabled programs
    const loyaltyPrograms = biz.loyaltyPrograms || [];
    const firstProgram = loyaltyPrograms.length > 0 ? loyaltyPrograms[0] : null;

    // Load service packages and incompatibilities (in try/catch - tables may not exist yet)
    let servicePackages: BusinessContext["servicePackages"] = [];
    let serviceIncompatibilities: BusinessContext["serviceIncompatibilities"] = [];
    try {
      const pkgs = await prisma.servicePackage.findMany({
        where: { businessId, isActive: true },
        include: { items: { include: { service: { select: { name: true, price: true } } } } },
      });
      servicePackages = pkgs.map((p) => {
        const regularPrice = p.items.reduce((sum, i) => sum + i.service.price, 0);
        let finalPrice = regularPrice;
        if (p.discountType === "percent" && p.discountPercent) {
          finalPrice = Math.round(regularPrice * (1 - p.discountPercent / 100));
        } else if (p.discountType === "fixed" && p.fixedPrice !== null) {
          finalPrice = p.fixedPrice;
        }
        return {
          name: p.name,
          description: p.description,
          services: p.items.map((i) => i.service.name),
          regularPrice,
          finalPrice,
          savedAmount: regularPrice - finalPrice,
          autoSuggest: p.autoSuggest,
        };
      });

      const incs = await prisma.serviceIncompatibility.findMany({
        where: { businessId },
        include: {
          serviceA: { select: { name: true } },
          serviceB: { select: { name: true } },
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      serviceIncompatibilities = incs.map((i: any) => ({
        serviceA: i.serviceA.name,
        // Use linked service name if present, otherwise free-form text
        // (e.g. "солнце", "баня", "алкоголь")
        serviceB: i.serviceB?.name || i.serviceBText || "—",
        cooldownDays: i.cooldownDays,
        bidirectional: i.bidirectional,
        reason: i.reason,
      }));
    } catch (e) {
      console.log("buildBusinessContext: packages/incompatibilities query failed (table may not exist yet)", e);
    }

    return {
      name: business.name,
      botDisplayName: (biz.botDisplayName as string | null) ?? null,
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
      servicePackages,
      serviceIncompatibilities,
      staff: business.staff,
      faqs: business.faqs,
      documents: business.documents,
      country: (business as Record<string, unknown>).country as string || "UZ",
      dashboardMode: (business as Record<string, unknown>).dashboardMode as string || "service",
      consultationsEnabled: Boolean((business as Record<string, unknown>).consultationsEnabled ?? false),
      loyalty: firstProgram ? {
        enabled: firstProgram.enabled,
        type: firstProgram.type,
        cashbackPercent: firstProgram.cashbackPercent,
        visitsForReward: firstProgram.visitsForReward,
        rewardType: firstProgram.rewardType,
        rewardDiscount: firstProgram.rewardDiscount,
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

// Anti-probe boundary — prepended at the very top of every user bot prompt so
// it has the highest LLM attention weight (system instructions earliest in the
// context have strongest grip on behavior). Hides Staffix/Claude/Anthropic etc.
import { ANTI_PROBE_USER_BOT } from "@/lib/security-prompts";

/**
 * Создаёт системный промпт с контекстом клиента и бизнеса
 */
/**
 * Возвращает системный промпт разделённым на два куска:
 *
 *   stable    — бизнес-контекст (имя, услуги, документы, FAQ, правила).
 *               Один и тот же для всех клиентов бизнеса. Caller оборачивает
 *               в cache_control + ttl:'1h' — переиспользуется десятки раз.
 *   variable  — клиентский контекст (имя, история визитов, summary, теги).
 *               Уникален для каждого клиента и иногда меняется в течение
 *               сессии. Caller оборачивает в cache_control + ttl:'5m'.
 *
 * До этого разделения у нас был один большой блок с cache_control. Любая
 * правка клиентского контекста ломала кэш для документов (а у клиента
 * типа Right Flight это до 20K символов справки) — каждое сообщение
 * стоило ~$0.10 вместо ~$0.005. Это была главная причина дрейфа $11/день
 * на одного клиента.
 */
/**
 * Строит system prompt для TG-бота в трёх кэшируемых блоках.
 *
 *   stable  — базовая часть без справочных документов. TTL 1h. Стабильна
 *             от вызова к вызову; cache-warmer держит её горячей.
 *   docs    — блок «Справочные документы: …». TTL 5m. Формируется из
 *             ПОДМНОЖЕСТВА документов, выбранного матчером под запрос клиента
 *             (см. src/lib/document-matcher.ts). Если docSubset не передан —
 *             в блок попадают все parsed-документы (fallback).
 *   variable — клиентский контекст. TTL 5m. Меняется от клиента к клиенту.
 */
export function buildSystemPrompt(
  business: BusinessContext,
  client: ClientContext | null,
  docSubset?: BusinessContext["documents"]
): { stable: string; docs: string; variable: string } {
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

  const botName = business.botDisplayName || "AI-помощник";

  let prompt = `${ANTI_PROBE_USER_BOT}

Ты — ${botName}, AI-сотрудник компании "${business.name}".

КРИТИЧЕСКИ ВАЖНО: Твоё имя — ${botName}. ВСЕГДА представляйся как ${botName}. Если клиент спрашивает как тебя зовут — отвечай "${botName}". Никогда не используй другое имя.

${business.aiRules ? `## ⭐ ПРАВИЛА ОТ ВЛАДЕЛЬЦА БИЗНЕСА — ВЫСШИЙ ПРИОРИТЕТ
Эти правила задал владелец бизнеса в настройках. Они перебивают любые рекомендации ниже по тексту (длине ответов, стилю продаж, формулировкам). Если рекомендация ниже противоречит правилу — следуй правилу.

${business.aiRules}

` : ""}## ДЛИНА ОТВЕТА
Правило по умолчанию: 1–3 коротких предложения (~300 символов). Люди в мессенджерах не читают простыни — короткий понятный ответ лучше длинной простыни.

ИСКЛЮЧЕНИЕ — когда можно и нужно длиннее:
- Клиент явно просит перечень («покажите все варианты», «какие туры», «список услуг», «что у вас есть»)
- Клиент спрашивает про конкретную услугу/тур/товар — нужно дать цену, длительность, что включено
- Клиент спросил «расскажи подробнее», «что входит», «опишите» — дай развёрнутое описание

В этих случаях **обязательно доводи мысль до конца** — не обрывайся на полуслове. Лучше дать полный ответ на 1500 символов чем оборваться на «(4» или «Скоростные по». Если понимаешь что не влезаешь в лимит — сократи каждый пункт, а не количество пунктов.

Если владелец бизнеса задал другую длину в правилах выше — следуй ему.

## ПРАВИЛА ВЕЖЛИВОСТИ (всегда, независимо от тона):
- ВСЕГДА обращайся к клиенту на "Вы". НИКОГДА не переходи на "ты", даже если клиент сам пишет на "ты".
- ВСЕГДА начинай первое сообщение с "Здравствуйте" или "Добрый день/вечер". НИКОГДА не используй "Привет", "Эй", "Хай", "Здорово", "Слышь" как приветствие.
- ЗАПРЕЩЁННЫЕ слова: "Прикольно", "Круто", "Топ", "Жиза", "Зачёт", "Ооо", ")" вместо эмодзи.
- Допустимы вежливые разговорные обороты: "Понимаю Вас.", "Хороший вопрос.", "Конечно.", "Кстати,", "Если позволите,", "Честно говоря,", "Рад был помочь."
- Эмодзи — умеренно, 0–1 на сообщение.

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
        .map((s) => `- ${s.name}: ${s.price} ${currencyLabel(business.country)} (${s.duration} мин)`)
        .join("\n")
    : "Услуги пока не добавлены в систему"
}
${business.servicePackages && business.servicePackages.length > 0 ? `
## Пакеты услуг (комбо со скидкой):
${business.servicePackages.map((p) => {
  const desc = p.description ? ` — ${p.description}` : "";
  const save = p.savedAmount > 0 ? ` (экономия ${p.savedAmount} ${currencyLabel(business.country)})` : "";
  return `- "${p.name}"${desc}: ${p.services.join(" + ")} = ${p.finalPrice} ${currencyLabel(business.country)}${save}${p.autoSuggest ? " [предлагай автоматически]" : ""}`;
}).join("\n")}

ВАЖНО про пакеты: когда клиент выбирает услугу из пакета, мягко предложи добавить остальные услуги пакета — это выгоднее. Например: "Можем сразу сделать стрижку + бороду в пакете — выйдет на 10% дешевле".
` : ""}
${business.serviceIncompatibilities && business.serviceIncompatibilities.length > 0 ? `
## Несовместимость услуг:
${business.serviceIncompatibilities.map((i) => {
  const dir = i.bidirectional ? "↔" : "→";
  const reason = i.reason ? ` (${i.reason})` : "";
  return `- ${i.serviceA} ${dir} ${i.serviceB}: нельзя ранее чем через ${i.cooldownDays} дней${reason}`;
}).join("\n")}

ВАЖНО про несовместимости: перед записью на услугу из этого списка проверь историю клиента (последние визиты выше). Если недавно была несовместимая услуга — мягко предупреди клиента и предложи альтернативу или другую дату. Не отказывай резко — объясни причину.
` : ""}

## Наши мастера/сотрудники:
${
  business.staff.length > 0
    ? business.staff
        .map((s) => `- ID: ${s.id} | Имя: ${s.name}${s.role ? ` | Специализация: ${s.role}` : ""}`)
        .join("\n")
    : "Сотрудники пока не добавлены"
}

ВАЖНО про мастеров и записи: когда вызываешь create_booking, ВСЕГДА передавай staff_id если в бизнесе больше одного мастера. Определи нужного мастера по контексту:
1. Клиент назвал имя мастера ("к Хасановой", "к Дилфузе") — найди его ID в списке выше
2. Клиент назвал специализацию ("к терапевту", "к кардиологу", "к парикмахеру") — найди мастера с подходящей специализацией
3. Услуга очевидно подразумевает конкретного специалиста (услуга "Терапевт первичный приём" — нужен мастер со специализацией "Терапевт"; услуга "ЭКГ" — кардиолог) — выбери его автоматически
4. Если несколько мастеров подходят и клиент не выбрал — спроси клиента "К кому записать: <имя1> или <имя2>?"
5. Только если клиент явно сказал "к любому свободному" или в бизнесе один мастер — можно не передавать staff_id

## ⭐ FAQ — АКТУАЛЬНАЯ ИНФОРМАЦИЯ ОТ ВЛАДЕЛЬЦА (главный источник правды):
${
  business.faqs.length > 0
    ? business.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "FAQ пока не добавлены"
}

🔑 ПРИОРИТЕТ ФАКТОВ (КРИТИЧНО):
- FAQ выше — самый свежий источник, владелец обновляет его вручную при изменении цен/дат/правил.
- Справочные документы (будут ниже, отдельным блоком) — фоновая информация, может содержать устаревшие данные (старые прайс-листы, прошлогодние программы туров и т.п.).
- Если FAQ и документ говорят разное про одну и ту же вещь (например цена тура, дата вылета, наличие услуги) — ВСЕГДА используй FAQ. Документ молчаливо игнорируй в этом конкретном пункте.
- Если в FAQ написано "продажа закрыта на 08.06" а в документе цена для 08.06 — НЕ предлагай 08.06 клиенту, FAQ перебивает.
- Если клиент спрашивает про факт, которого нет в FAQ, но есть в документе — можно использовать документ, но с оговоркой "по нашим данным" и предложением уточнить у менеджера если данные критичны.

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

## Твои задачи:
1. Отвечать на вопросы клиентов о компании и услугах
2. Помогать с записью на услуги — используй инструменты для проверки свободных слотов и создания записей
3. Собирать контактные данные для записи (имя, телефон)
4. Если не можешь ответить — предложи связаться с администратором

## ВАЖНО — Работа с записями:
- Когда клиент хочет записаться — ОБЯЗАТЕЛЬНО используй инструмент check_availability чтобы проверить свободные слоты
- НЕ ВЫДУМЫВАЙ доступное время — только показывай реальные свободные слоты из инструмента
- Перед созданием записи собери ВСЕ четыре поля: услуга, дата, время, имя клиента И телефон. Телефон обязателен — без него create_booking не сработает.
- Если в данных клиента уже есть имя/телефон — используй их и не переспрашивай. Если телефона нет — попроси одним коротким сообщением: "Подскажите ваш номер для записи, чтобы мастер мог связаться при изменениях".
- После подтверждения клиентом и наличия телефона — создай запись через create_booking
- Если клиент спрашивает о своих записях — используй get_my_bookings
- Предлагай только РЕАЛЬНО свободные слоты, не придумывай время

## ПРОДАЮЩИЙ СТИЛЬ ОБЩЕНИЯ (применяй естественно, в рамках лимита длины выше):
- Прежде чем предлагать решение — коротко уточни потребность (стиль, мастер, срок). Не задавай больше одного уточняющего вопроса за раз.
- Сначала ценность (результат / опыт мастера / что входит), потом цена. Не начинай с цифры.
- На возражение "дорого" не извиняйся — сравни с результатом или предложи вариант попроще.
- Если слотов из check_availability реально мало — мягко обозначь срочность. Не выдумывай дефицит.
- После записи можешь один раз предложить ОДНУ сопутствующую услугу. Не навязывай.
- Постоянных клиентов узнавай по истории и теплее обращайся.

**Чего НЕ делать:**
- Не давить, не торопить, не задавать список вопросов сразу.
- Не предлагать скидки без правил от владельца.
- Не упоминать конкурентов и не обещать то, чего нет в прайсе/FAQ.
- НИКОГДА не пиши "я передал менеджеру" БЕЗ фактического вызова notify_manager — это ложь.

## ФОРМАТ ОТВЕТА (КРИТИЧНО)
Пиши клиенту ПРОСТЫМ ТЕКСТОМ, как человек в мессенджере. НЕ используй Markdown:
- Никаких **звёздочек** для жирного, ## для заголовков, [ссылок](url) с квадратными скобками
- Никаких подчёркиваний _курсивом_, обратных кавычек \` для кода
- Списки — нумеруй (1., 2.) или пиши через перенос строки, без "—" или "*" в начале
- Если хочется выделить важное — используй ЗАГЛАВНЫЕ или эмодзи 🔴 ⭐ ✅, а не Markdown
- Названия услуг/мастеров пиши как есть, без выделения форматированием

Пример НЕПРАВИЛЬНО: **Стрижка** у мастера *Анны* — 5000 ₸
Пример ПРАВИЛЬНО: Стрижка у мастера Анны — 5000 ₸

## ЯЗЫКОВАЯ ПОЛИТИКА (имена и описания)
- Названия услуг, имена мастеров, названия процедур — оставляй как они в каталоге.
- Описания, объяснения, характеристики — на языке клиента (русский / узбекский / казахский / английский).
- Если клиент пишет обиходным словом — найди в каталоге, но в ответе называй официально как у бизнеса.

## ЭСКАЛАЦИЯ К ЖИВОМУ МЕНЕДЖЕРУ — КРИТИЧНО
Когда клиент: задаёт вопрос на который ты не знаешь точный ответ (нет в FAQ/документах/услугах), просит цены/даты которых нет в твоей базе, явно говорит "хочу поговорить с человеком/менеджером", жалуется, или просит нестандартное — ты ОБЯЗАН вызвать tool **notify_manager**.

⚠️ ПРАВИЛО ИСТИНЫ: если ты говоришь клиенту "я передал запрос", "сообщил менеджеру", "наш сотрудник свяжется" — это означает что ты УЖЕ вызвал notify_manager в этом ответе. Если ты НЕ вызвал tool, ты НЕ ИМЕЕШЬ ПРАВА говорить что передал — это ложь клиенту, и владелец бизнеса никогда не узнает что от него ждут.

Алгоритм:
1. Можешь спросить подтверждение ("Передать ваш запрос менеджеру?") — необязательно
2. ВЫЗОВИ notify_manager: reason = суть запроса (1-2 предложения), client_name = имя клиента, urgency = "urgent" если клиент жалуется/срочно, иначе "normal"
3. ТОЛЬКО после успешного вызова tool — отвечай "Передал, менеджер свяжется"
`;

  // ── Здесь заканчивается стабильный (кэшируемый) префикс ──
  const stable = prompt;

  // Блок docs — отдельный cache-entry с TTL 5m. Формируется из docSubset
  // если передан (lazy-loading путь), иначе из всех parsed-документов
  // (fallback, поведение до июля 2026).
  const docsSource = docSubset ?? business.documents;
  const docsWithText = docsSource.filter((d) => d.extractedText);
  let docs = "";
  if (docsWithText.length > 0) {
    // Ограничиваем каждый документ 4000 символами и берём максимум 5 —
    // те же лимиты что были у inline-версии в stable до этого рефакторинга.
    const parts = docsWithText.slice(0, 5).map((d) => {
      const t = d.extractedText!;
      const trimmed = t.length > 4000 ? t.substring(0, 4000) + "..." : t;
      return `### ${d.name}:\n${trimmed}`;
    });
    docs = `## Справочные документы (фоновая информация — могут содержать устаревшие данные):\n${parts.join("\n\n")}`;
  }

  // Дальше — переменный хвост: клиентский контекст. Меняется на каждого
  // клиента и иногда — внутри одного диалога (когда summary обновляется).
  let variable = "";

  if (!client || client.totalVisits === 0) {
    variable += `\n## СТРАТЕГИЯ ДЛЯ НОВОГО КЛИЕНТА:\nЭто новый клиент. Сначала поздоровайся и узнай его имя. Затем задай 1-2 вопроса чтобы понять потребность. Не вываливай весь прайс сразу — предложи наиболее подходящую услугу.`;
  }

  if (client) {
    variable += `\n\n## ИНФОРМАЦИЯ О КЛИЕНТЕ (используй для персонализации):`;

    if (client.name) {
      variable += `\n- Имя: ${client.name}`;
    }

    if (client.totalVisits > 0) {
      variable += `\n- Был у нас: ${client.totalVisits} раз(а)`;
    }

    if (client.lastVisitDate) {
      const lastVisit = new Date(client.lastVisitDate);
      variable += `\n- Последний визит: ${lastVisit.toLocaleDateString("ru-RU")}`;
    }

    if (client.summary) {
      variable += `\n- О клиенте: ${client.summary}`;
    }

    if (client.importantNotes) {
      variable += `\n- ВАЖНО: ${client.importantNotes}`;
    }

    if (client.preferences) {
      const prefs = client.preferences;
      if (prefs.preferredServices) {
        variable += `\n- Предпочитает: ${(prefs.preferredServices as string[]).join(", ")}`;
      }
    }

    if (client.recentBookings.length > 0) {
      variable += `\n- Последние записи:`;
      for (const booking of client.recentBookings.slice(0, 3)) {
        const date = new Date(booking.date).toLocaleDateString("ru-RU");
        variable += `\n  • ${date}: ${booking.serviceName || "услуга"} (${booking.status})`;
      }
    }

    if (client.conversationSummaries.length > 0) {
      variable += `\n- Из прошлых разговоров:`;
      for (const summary of client.conversationSummaries) {
        variable += `\n  • ${summary}`;
      }
    }

    if (client.tags.length > 0) {
      variable += `\n- Теги: ${client.tags.join(", ")}`;
    }

    if (client.loyaltyPoints > 0) {
      variable += `\n- Бонусные баллы: ${client.loyaltyPoints}`;
    }
    if (client.loyaltyVisits > 0) {
      variable += `\n- Визитов (лояльность): ${client.loyaltyVisits}`;
    }
    if (client.loyaltyTotalSpent > 0) {
      variable += `\n- Общая сумма покупок: ${client.loyaltyTotalSpent.toLocaleString()}`;
    }
  }

  return { stable, docs, variable };
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
  clientName?: string,
  telegramUsername?: string | null
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
        telegramUsername: telegramUsername || null,
        totalMessages: 1,
        lastMessageAt: new Date(),
      },
      update: {
        name: clientName || undefined,
        // Юзеры могут менять @handle — всегда перезаписываем последним значением.
        // null оставляем как есть (если username вдруг скрыт — не стираем старый).
        telegramUsername: telegramUsername || undefined,
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
/**
 * AI-извлечение custom fields из истории диалогов клиента.
 *
 * Берёт определения полей из Business.clientFieldsConfig, последние summaries
 * разговоров и сообщения, и просит Claude вытащить структурированные значения.
 * Обновляет ТОЛЬКО те поля где AI уверен и существующее значение пустое —
 * не перезаписывает то что менеджер заполнил руками.
 *
 * No-op если у бизнеса нет custom fields в конфиге, или нет API-ключа,
 * или клиент новый и истории недостаточно.
 */
export async function extractCustomFieldsFromConversation(
  businessId: string,
  telegramId: bigint
): Promise<{ updated: number } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { clientFieldsConfig: true },
    });
    const config = (business?.clientFieldsConfig as Array<{
      key: string;
      label: string;
      type: "text" | "number" | "date" | "select";
      options?: string[];
    }>) || [];
    if (config.length === 0) return null;

    const client = await prisma.client.findUnique({
      where: { businessId_telegramId: { businessId, telegramId } },
      select: { id: true, customFields: true },
    });
    if (!client) return null;

    const existing = (client.customFields as Record<string, unknown>) || {};
    // Только поля которые ещё не заполнены — не перетираем ручной ввод.
    const fieldsToExtract = config.filter(
      (f) => existing[f.key] === undefined || existing[f.key] === null || existing[f.key] === ""
    );
    if (fieldsToExtract.length === 0) return { updated: 0 };

    // Берём последние сообщения и summary разговоров.
    const conversations = await prisma.conversation.findMany({
      where: { businessId, clientTelegramId: telegramId },
      select: { summary: true, extractedInfo: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    const messages = await prisma.message.findMany({
      where: {
        conversation: { businessId, clientTelegramId: telegramId },
        role: "user",
      },
      select: { content: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    if (conversations.length === 0 && messages.length === 0) return null;

    const fieldsDescription = fieldsToExtract
      .map((f) => {
        if (f.type === "select" && f.options?.length) {
          return `- ${f.key} (${f.label}, выбор из: ${f.options.join(", ")})`;
        }
        return `- ${f.key} (${f.label}, тип: ${f.type})`;
      })
      .join("\n");

    const summariesText = conversations
      .map((c) => c.summary)
      .filter(Boolean)
      .join("\n");
    const messagesText = messages.map((m) => m.content).reverse().join("\n");

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Извлеки значения полей из истории общения с клиентом.

Поля для извлечения:
${fieldsDescription}

ПРАВИЛА:
- Возвращай ТОЛЬКО JSON-объект, без пояснений и markdown.
- Включай только те поля где значение явно упомянуто в тексте.
- НЕ ДОГАДЫВАЙСЯ. Если поле не упомянуто — пропусти его.
- Для типа "date" — формат YYYY-MM-DD.
- Для "number" — только число без единиц.
- Для "select" — точно одно из перечисленных значений.
- Для "text" — короткая строка (до 100 символов).

Резюме разговоров:
${summariesText || "(нет резюме)"}

Сообщения клиента:
${messagesText.slice(0, 6000)}

JSON:`,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (!raw) return { updated: 0 };

    // Стрипнуть markdown-код-блок если AI добавил
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.warn(`extractCustomFields: не смог распарсить JSON от AI: ${raw.slice(0, 200)}`);
      return { updated: 0 };
    }

    // Валидация и фильтр — только разрешённые ключи + существующее не перезаписываем.
    const configByKey = new Map(fieldsToExtract.map((f) => [f.key, f]));
    const merged: Record<string, unknown> = { ...existing };
    let updatedCount = 0;
    for (const [k, v] of Object.entries(parsed)) {
      const def = configByKey.get(k);
      if (!def) continue;
      if (v === null || v === undefined || v === "") continue;
      if (def.type === "number") {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        merged[k] = n;
      } else if (def.type === "date") {
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime())) continue;
        merged[k] = d.toISOString().slice(0, 10);
      } else if (def.type === "select") {
        const str = String(v);
        if (def.options && !def.options.includes(str)) continue;
        merged[k] = str;
      } else {
        merged[k] = String(v).slice(0, 200);
      }
      updatedCount++;
    }

    if (updatedCount > 0) {
      await prisma.client.update({
        where: { id: client.id },
        data: { customFields: merged as unknown as object },
      });
    }
    return { updated: updatedCount };
  } catch (error) {
    console.warn(`extractCustomFieldsFromConversation(${businessId}, ${telegramId}) failed:`, error);
    return null;
  }
}

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
 * Извлекает телефон из произвольного текстового сообщения.
 *
 * Старая версия требовала, чтобы вся очищенная строка совпадала с шаблоном
 * (`^...$`) — это рвалось на любом сообщении с побочными цифрами:
 * "запиши на 14:00 +998901234567" → "1400+998901234567" → не матчит.
 *
 * Новая версия:
 * 1. Ищет подстроку телефона внутри текста (не требует, чтобы весь текст был
 *    номером).
 * 2. Нормализует российский формат: 8XXXXXXXXXX → +7XXXXXXXXXX.
 * 3. Поддерживает разделители (пробелы, скобки, дефисы) между группами цифр.
 *
 * Покрывает: +998 90 123-45-67, +7 (701) 234-56-78, 8-901-234-56-78,
 * 998901234567, и любые комбинации с разделителями.
 */
export function extractPhone(message: string): string | null {
  // Жадно ищем последовательности цифр, +, пробелов, скобок, дефисов длиной
  // ≥10 символов — это потенциальные номера. Якорим начало по +, цифре или
  // границе слова, чтобы не цеплять середину артикулов вроде "ABC123456789".
  const candidateRegex = /(?:^|[^\d])(\+?[\d][\d\s()\-]{8,20}\d)/g;
  const matches = Array.from(message.matchAll(candidateRegex));
  if (matches.length === 0) return null;

  const validCountryCodes2 = ["7"];
  const validCountryCodes3 = ["998", "996", "995", "994", "993", "992", "380", "375"];

  for (const m of matches) {
    const raw = m[1];
    let digits = raw.replace(/[^\d]/g, "");

    // 8XXXXXXXXXX (RU/KZ старый формат) → 7XXXXXXXXXX
    if (digits.length === 11 && digits.startsWith("8")) {
      digits = "7" + digits.slice(1);
    }

    // 11 цифр, страна = 7 (РФ/Казахстан)
    if (digits.length === 11 && validCountryCodes2.includes(digits[0])) {
      return "+" + digits;
    }

    // 12 цифр, страна — один из 3-значных кодов СНГ/UA/BY
    if (digits.length === 12 && validCountryCodes3.includes(digits.slice(0, 3))) {
      return "+" + digits;
    }
  }

  return null;
}
