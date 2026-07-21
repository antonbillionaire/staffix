/**
 * AI response engine for WhatsApp, Instagram DM, and Facebook Messenger channels.
 * Now includes booking tools (check_availability, create_booking, etc.)
 * so all channels share the same booking database with conflict checking
 * and notifications.
 */

import { prisma } from "@/lib/prisma";
import { dispatchCrmEvent } from "@/lib/crm-integrations";
import { logActivityFireAndForget } from "@/lib/activity-log";
import {
  bookingToolDefinitions,
  checkAvailability,
  createBookingFromChannel,
  getServicesList,
  getStaffList,
  updateLeadStatus,
  getClientBookings,
  cancelBooking,
  searchProducts,
} from "@/lib/booking-tools";
import {
  salesToolDefinitions,
  createOrder,
  getClientOrders,
  getProductDetails,
  getCategories,
  getUpsellSuggestions,
  listByCategory,
  identifyClientByPhone,
} from "@/lib/sales-tools";

import Anthropic from "@anthropic-ai/sdk";
import { callClaudeWithRetry, logClaudeUsage, trackClaudeUsage } from "@/lib/claude-retry";
import { pickCacheStrategy } from "@/lib/cache-strategy";
import { pickRelevantDocuments } from "@/lib/document-matcher";
import { pickMainModel } from "@/lib/complexity-classifier";
// Anti-probe boundary — prepended to every WA/IG/FB user-bot system prompt
// so it has the highest LLM attention weight.
import { ANTI_PROBE_USER_BOT } from "@/lib/security-prompts";

type HistoryMessage = { role: "user" | "assistant"; content: string };

// Channel booking tools — subset of full booking tools + lead qualification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// AI Learning: tool for saving client notes
const saveClientNoteTool = {
  name: "save_client_note",
  description: "Сохранить важную заметку о клиенте (предпочтение, аллергия, важная деталь). Используй когда узнаёшь что-то важное о клиенте в разговоре.",
  input_schema: {
    type: "object" as const,
    properties: {
      note_type: {
        type: "string",
        enum: ["preference", "allergy", "important", "style"],
        description: "Тип заметки: preference=предпочтение, allergy=аллергия/противопоказание, important=важная информация, style=стиль общения",
      },
      content: {
        type: "string",
        description: "Содержание заметки",
      },
    },
    required: ["note_type", "content"],
  },
};

const channelBookingTools: any[] = [
  ...bookingToolDefinitions.filter(
    (t: { name: string }) =>
      ["check_availability", "create_booking", "get_services", "get_staff", "update_lead_status", "get_my_bookings", "cancel_booking", "notify_manager", "search_products", "list_packages", "book_package"].includes(t.name)
  ),
  saveClientNoteTool,
];

// Channel sales tools — for store/shop businesses (create_order, get_client_orders + shared tools)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const channelSalesTools: any[] = [
  ...salesToolDefinitions.filter(
    (t: { name: string }) =>
      ["search_products", "get_product_details", "get_categories", "list_by_category", "create_order", "get_client_orders", "get_upsell_suggestions", "identify_client"].includes(t.name)
  ),
  ...bookingToolDefinitions.filter(
    (t: { name: string }) =>
      ["update_lead_status", "notify_manager"].includes(t.name)
  ),
  saveClientNoteTool,
];

// Sales + consultations: store/online-school hybrid where AI both takes orders
// AND books free meetings/consultations (онлайн-школы, консалтинг, коучи).
// Used when Business.consultationsEnabled = true.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const channelSalesPlusBookingTools: any[] = [
  ...salesToolDefinitions.filter(
    (t: { name: string }) =>
      ["search_products", "get_product_details", "get_categories", "list_by_category", "create_order", "get_client_orders", "get_upsell_suggestions", "identify_client"].includes(t.name)
  ),
  ...bookingToolDefinitions.filter(
    (t: { name: string }) =>
      ["check_availability", "create_booking", "get_services", "get_staff", "update_lead_status", "get_my_bookings", "cancel_booking", "notify_manager", "list_packages", "book_package"].includes(t.name)
  ),
  saveClientNoteTool,
];

/**
 * Get or create a ChannelConversation record for this client
 */
async function getOrCreateChannelConv(
  businessId: string,
  channel: string,
  clientId: string,
  clientName?: string
) {
  let conv = await prisma.channelConversation.findUnique({
    where: { businessId_channel_clientId: { businessId, channel, clientId } },
  });
  if (!conv) {
    conv = await prisma.channelConversation.create({
      data: { businessId, channel, clientId, clientName, history: [] },
    });
  }
  return conv;
}

/**
 * Load business profile for the system prompt
 */
async function loadBusinessProfile(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      businessType: true,
      dashboardMode: true,
      consultationsEnabled: true,
      phone: true,
      address: true,
      workingHours: true,
      welcomeMessage: true,
      aiTone: true,
      aiRules: true,
      botDisplayName: true,
      language: true,
      city: true,
      country: true,
      services: { select: { name: true, description: true, price: true, duration: true }, take: 50 },
      products: { select: { name: true, description: true, price: true, category: true, stock: true }, take: 300 },
      faqs: { select: { question: true, answer: true }, take: 20 },
      staff: { select: { id: true, name: true, role: true }, take: 10 },
      // id + description/autoDescription — для lazy-loading матчера
      // (см. src/lib/document-matcher.ts)
      documents: {
        where: { parsed: true },
        select: {
          id: true,
          name: true,
          extractedText: true,
          description: true,
          autoDescription: true,
        },
        take: 10,
      },
    },
  });
}

/**
 * Build system prompt for channel AI
 */
export function buildChannelSystemPrompt(
  biz: NonNullable<Awaited<ReturnType<typeof loadBusinessProfile>>>,
  channel: string
): string {
  const channelName =
    channel === "whatsapp" ? "WhatsApp" :
    channel === "instagram" ? "Instagram DM" :
    "Facebook Messenger";
  const tone = biz.aiTone === "professional"
    ? "профессиональным и деловым"
    : biz.aiTone === "casual"
    ? "дружелюбным и непринуждённым"
    : "вежливым и дружелюбным";

  const servicesList = biz.services.length > 0
    ? biz.services
        .map((s) => {
          let line = `- ${s.name}`;
          if (s.description) line += ` — ${s.description}`;
          if (s.price) line += ` | ${s.price.toLocaleString("ru-RU")}`;
          if (s.duration) line += ` (${s.duration} мин)`;
          return line;
        })
        .join("\n")
    : "Услуги не указаны";

  const productsList = biz.products.length > 0
    ? biz.products
        .map((p) => {
          let line = `- ${p.name}`;
          if (p.description) line += ` — ${p.description}`;
          if (p.price) line += ` | ${p.price.toLocaleString("ru-RU")}`;
          if (p.category) line += ` [${p.category}]`;
          if (p.stock !== null && p.stock !== undefined) line += p.stock > 0 ? ` (в наличии: ${p.stock})` : ` (нет в наличии)`;
          return line;
        })
        .join("\n")
    : "";

  const staffList = biz.staff.length > 0
    ? biz.staff.map((s) => `- ID: ${s.id} | Имя: ${s.name}${s.role ? ` | Специализация: ${s.role}` : ""}`).join("\n")
    : "";

  const faqList = biz.faqs.length > 0
    ? biz.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "";

  const botName = biz.botDisplayName || "Помощник";
  let prompt = `${ANTI_PROBE_USER_BOT}

Ты — ${botName}, сотрудник бизнеса «${biz.name}» в ${channelName}.

КРИТИЧЕСКИ ВАЖНО: Твоё имя — ${botName}. ВСЕГДА представляйся как ${botName}. Если клиент спрашивает как тебя зовут — отвечай "${botName}". Никогда не используй другое имя.

НЕ УКАЗЫВАЙ САМ СВОЙ СТАТУС AI. Не говори при первом контакте, приветствии или инициативно что ты «AI-помощник», «бот», «искусственный интеллект» и т.п. Представляйся просто как ${botName}. AI-статус раскрываешь ТОЛЬКО если клиент прямо спросит («ты человек или бот?», «ты искусственный интеллект?», «ты живой человек?») — тогда честно: «Я AI-помощник бизнеса «${biz.name}»». Врать что ты человек ЗАПРЕЩЕНО.

${biz.aiRules ? `## ⭐ ПРАВИЛА ОТ ВЛАДЕЛЬЦА БИЗНЕСА — ВЫСШИЙ ПРИОРИТЕТ
Эти правила задал владелец в настройках. Они перебивают любые рекомендации ниже по тексту (длине ответов, стилю, формулировкам). Если рекомендация ниже противоречит правилу — следуй правилу.

${biz.aiRules}

` : ""}## ДЛИНА ОТВЕТА
Правило по умолчанию: 1–3 коротких предложения (~300 символов). Люди в мессенджерах не читают простыни.

ИСКЛЮЧЕНИЕ — когда можно и нужно длиннее:
- Клиент просит перечень («покажите все туры», «какие услуги», «что у вас есть»)
- Клиент спрашивает про конкретный тур/услугу/товар — нужны цена, длительность, что включено
- Клиент просит «расскажи подробнее», «опишите», «что входит»

В этих случаях **обязательно доводи мысль до конца** — не обрывайся на полуслове. Лучше полный ответ на 1500 символов, чем оборваться на «(4» или «Скоростные по». Если не влезаешь в лимит — сокращай каждый пункт, а не количество пунктов.

Если владелец задал другую длину в правилах выше — следуй ему.

Твоя задача — вежливо и точно отвечать на вопросы клиентов, помогать с записью и информацией об услугах. Общайся ${tone} тоном.

## ⚠️ ПРАВИЛО КОНТАКТА КЛИЕНТА (критично — лиды теряются без телефона)
ЗАПРЕЩЕНО обещать «менеджер свяжется», «менеджер расскажет», «мы перезвоним», «оставим заявку», «передам менеджеру», «специалист ответит», «сотрудник вернётся к вам» — ПОКА не получил от клиента номер телефона.

Если клиент проявил интерес («расскажите подробнее», «интересно», «хочу узнать», «как записаться», «а какие цены», «хочу с человеком поговорить», «дайте больше информации», просто «старт» или короткое подтверждение) — СНАЧАЛА одной короткой фразой попроси номер:
- Пример: «Подскажите, пожалуйста, ваш номер телефона и удобное время — наш менеджер свяжется и всё подробно расскажет.»
- Или: «Оставьте, пожалуйста, номер — перезвоним и ответим на все вопросы.»

ТОЛЬКО после того как клиент дал номер — можешь сказать «передал менеджеру, свяжется в удобное время».

Исключения (можно эскалировать сразу без номера через notify_manager):
- Клиент открыто жалуется, ругается, требует человека прямо сейчас — тогда эскалируй, менеджер ответит в том же канале (IG DM / TG / WA).
- Клиент явно отказался давать номер («не хочу оставлять телефон», «пишите тут»).
- Клиент прямо ответил в текущий чат что уже есть контакт (например «пишите на этот же telegram»).

## ПРАВИЛА ВЕЖЛИВОСТИ (всегда, независимо от тона):
- ВСЕГДА обращайся к клиенту на "Вы". НИКОГДА не переходи на "ты", даже если клиент сам пишет на "ты".
- ВСЕГДА начинай первое сообщение с "Здравствуйте" или "Добрый день/вечер". НИКОГДА не используй "Привет", "Эй", "Хай", "Здорово", "Слышь" как приветствие.
- ЗАПРЕЩЁННЫЕ слова: "Прикольно", "Круто", "Топ", "Жиза", "Зачёт", "Ооо", ")" вместо эмодзи.
- Допустимы вежливые разговорные обороты: "Понимаю Вас.", "Хороший вопрос.", "Конечно.", "Кстати,", "Если позволите,", "Честно говоря,", "Рад был помочь."
- Эмодзи — умеренно, 0–1 на сообщение.`;

  if (biz.address) prompt += `\n\nАдрес: ${biz.address}`;
  if (biz.phone) prompt += `\nТелефон: ${biz.phone}`;
  if (biz.workingHours) prompt += `\nРежим работы: ${biz.workingHours}`;
  if (biz.city) prompt += `\nГород: ${biz.city}`;

  prompt += `\n\nУслуги:\n${servicesList}`;

  if (productsList) prompt += `\n\nТовары:\n${productsList}`;

  if (staffList) {
    prompt += `\n\nСпециалисты:\n${staffList}`;
    prompt += `\n\nВАЖНО про мастеров: при create_booking ВСЕГДА передавай staff_id если в бизнесе больше одного мастера. Определи нужного мастера: (1) клиент назвал имя — найди ID; (2) клиент назвал специализацию — найди мастера с подходящей ролью; (3) услуга подразумевает специалиста (например "Терапевт первичный приём" → мастер с ролью "Терапевт") — выбери его; (4) если несколько подходят — спроси клиента; (5) только если клиент сказал "к любому" — можно не передавать.`;
  }

  // FAQ — свежие данные от владельца. Документы — фоновая справка, идёт в
  // конец промпта (см. renderChannelDocsBlock ниже) и попадает в ОТДЕЛЬНЫЙ
  // cache-блок с коротким TTL, чтобы lazy-loading матчера мог варьировать
  // набор документов без потери 1h-кэша основной части промпта.
  if (faqList) {
    prompt += `\n\n⭐ FAQ — АКТУАЛЬНАЯ ИНФОРМАЦИЯ ОТ ВЛАДЕЛЬЦА (главный источник правды):\n${faqList}`;
    prompt += `\n\n🔑 ПРИОРИТЕТ ФАКТОВ (КРИТИЧНО):
- FAQ выше — самый свежий источник, владелец обновляет его вручную при изменении цен/дат/правил.
- Справочные документы (будут ниже) — фоновая информация, может содержать устаревшие данные (старые прайс-листы, прошлогодние программы туров и т.п.).
- Если FAQ и документ говорят разное про одну и ту же вещь (например цена тура, дата вылета, наличие услуги) — ВСЕГДА используй FAQ. Документ молчаливо игнорируй в этом конкретном пункте.
- Если в FAQ написано "продажа закрыта на 08.06" а в документе цена для 08.06 — НЕ предлагай 08.06 клиенту, FAQ перебивает.
- Если клиент спрашивает про факт, которого нет в FAQ, но есть в документе — можно использовать документ, но с оговоркой "по нашим данным" и предложением уточнить у менеджера если данные критичны.`;
  }

  if (biz.welcomeMessage) {
    prompt += `\n\nПриветственное сообщение для новых клиентов:\n${biz.welcomeMessage}`;
  }

  // Owner rules moved to top of prompt (highest LLM attention) — they were
  // here at the very bottom and got drowned by the rules above.

  prompt += `\n\nФОРМАТ ОТВЕТА (КРИТИЧНО):
Пиши клиенту ПРОСТЫМ ТЕКСТОМ, как человек в мессенджере. НЕ используй Markdown:
- Никаких **звёздочек** для жирного, ## для заголовков, [ссылок](url) с квадратными скобками
- Никаких подчёркиваний _курсивом_, обратных кавычек \` для кода
- Списки — нумеруй (1., 2.) или через перенос строки, без "—" или "*" в начале
- Если хочется выделить важное — заглавными или эмодзи 🔴 ⭐ ✅, не Markdown
- Названия товаров/брендов пиши как есть в каталоге, без форматирования

ЯЗЫКОВАЯ ПОЛИТИКА:
- Названия товаров/услуг/брендов — оставляй как есть в каталоге (английский, латиница допустимы).
- Описания и объяснения — на языке клиента.
- Если клиент пишет обиходным словом ("ремувер" вместо "Glue Remover") — найди в каталоге, но в ответе называй официально.`;

  prompt += `\n\nУ тебя есть инструменты для записи клиентов. Когда клиент хочет записаться:
1. Уточни имя, желаемую услугу, мастера (если важно) и удобную дату
2. Проверь доступные слоты через check_availability
3. Предложи свободное время
4. Собери телефон клиента. На WhatsApp он уже известен (это его WA-номер), на Instagram/Facebook — спроси одним коротким сообщением: "Подскажите ваш номер для записи, чтобы мастер мог связаться при изменениях". Без телефона create_booking не сработает.
5. После подтверждения клиентом и наличия телефона — создай запись через create_booking
Записи создаются автоматически, клиенту не нужно звонить.

Квалификация лидов — после каждого сообщения оцени статус клиента и вызови update_lead_status если статус изменился:
- cold: первое обращение, общий вопрос, приветствие
- warm: интерес к конкретной услуге, спрашивает цены, детали, расписание
- hot: хочет записаться, обсуждает конкретное время, готов к покупке
- client: записался или купил услугу
Статус можно только повышать, никогда не понижай. Вызывай update_lead_status тихо, не сообщай клиенту о квалификации.

Если в каталоге есть несколько позиций с одинаковым или похожим названием (разные размеры, характеристики, варианты) — ВСЕГДА показывай ВСЕ варианты клиенту и уточняй, какой именно нужен. Используй описания из каталога и базы знаний, чтобы объяснить разницу между вариантами.

Если клиент спрашивает о товаре, которого нет в списке выше, или если нужно найти товар по ключевому слову или категории — используй инструмент search_products. Он ищет по всей базе товаров (не только по тем, что в списке выше).

Если в разговоре узнаёшь что-то важное о клиенте (предпочтения, аллергии, важные детали, стиль общения) — вызови save_client_note чтобы запомнить это. Делай это тихо, не сообщай клиенту.

Отвечай на языке клиента (русский, узбекский, казахский, английский).`;

  const today = new Date().toISOString().split("T")[0];
  prompt += `\n\nСегодняшняя дата: ${today}. Используй инструменты для работы с записями.`;

  // Docs section в самом конце — так его можно отделить в отдельный cache-блок
  // (см. buildChannelSystemPromptParts). Тут — full-fat версия для warmer'а
  // и как fallback когда матчер не отработал.
  const docsBlock = renderChannelDocsBlock(biz.documents);
  if (docsBlock) prompt += `\n\n${docsBlock}`;

  return prompt;
}

/**
 * Формирует блок «Справочные документы: …» из списка Document-descriptor'ов.
 * Возвращает пустую строку если documents пуст или ни у одного нет parsed-текста.
 *
 * MAX_DOCS_TOTAL_CHARS = 50000 — тот же лимит что был у старой inline-версии,
 * защищает от разросшихся файлов клиента (в проде видели PDF на 200KB).
 */
function renderChannelDocsBlock(
  docs: Array<{ name: string; extractedText: string | null }>
): string {
  const MAX_DOCS_TOTAL_CHARS = 50000;
  const withText = docs.filter((d) => d.extractedText && d.extractedText.length > 0);
  if (withText.length === 0) return "";

  const parts: string[] = [];
  let totalChars = 0;
  for (const d of withText) {
    const remaining = MAX_DOCS_TOTAL_CHARS - totalChars;
    if (remaining <= 0) break;
    const full = d.extractedText!;
    const text = full.length > remaining ? full.substring(0, remaining) + "..." : full;
    parts.push(`### ${d.name}:\n${text}`);
    totalChars += text.length;
  }
  return `Справочные документы (фоновая информация — могут содержать устаревшие данные):\n${parts.join("\n\n")}`;
}

/**
 * Разбивает channel system prompt на два независимо-кэшируемых блока для
 * lazy document loading (июль 2026).
 *
 *   base — стабильная часть (роль бота, услуги, товары, FAQ, инструкции).
 *          Кэшируется на 1h. При смене документов НЕ меняется, cache-hit
 *          сохраняется.
 *   docs — блок «Справочные документы: …». Формируется из ПОДМНОЖЕСТВА
 *          документов, выбранных матчером под конкретный запрос клиента.
 *          Кэшируется на 5m — при повторе того же запроса cache-hit, при
 *          смене темы дешёвый write.
 *
 * Если docSubset не передан → docs формируется из всех parsed-документов
 * (fallback режим, поведение как у buildChannelSystemPrompt).
 * Если docSubset пустой массив → docs = "" (nothing to inject).
 */
export function buildChannelSystemPromptParts(
  biz: NonNullable<Awaited<ReturnType<typeof loadBusinessProfile>>>,
  channel: string,
  docSubset?: Array<{ name: string; extractedText: string | null }>
): { base: string; docs: string } {
  const full = buildChannelSystemPrompt(biz, channel);
  // buildChannelSystemPrompt всегда завершает docsBlock в конце (если docs есть).
  // Мы аккуратно отрезаем его: находим «Справочные документы (фоновая…» — это
  // единственный маркер этого блока в prompt.
  const marker = "\n\nСправочные документы (фоновая информация";
  const idx = full.indexOf(marker);
  const base = idx === -1 ? full : full.substring(0, idx);

  const docsSource = docSubset === undefined ? biz.documents : docSubset;
  const docs = renderChannelDocsBlock(docsSource);
  return { base, docs };
}

/**
 * Handle tool calls from Claude for channel conversations
 */
async function handleChannelToolCall(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInput: Record<string, any>,
  businessId: string,
  clientId: string,
  channel: string,
  clientName?: string
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
        const result = await createBookingFromChannel(
          businessId,
          toolInput.date,
          toolInput.time,
          toolInput.client_name,
          clientId,
          channel,
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

      case "list_packages": {
        const { listServicePackages } = await import("./booking-tools");
        const packages = await listServicePackages(businessId);
        return JSON.stringify(packages);
      }

      case "book_package": {
        const { createPackageBooking } = await import("./booking-tools");
        const result = await createPackageBooking({
          businessId,
          packageId: toolInput.package_id,
          dateStr: toolInput.date,
          timeStr: toolInput.time,
          clientName: toolInput.client_name || clientName || "Клиент",
          clientPhone: toolInput.client_phone || "",
          // clientTelegramId у канальных клиентов нет (не-TG) — оставляем undefined
          staffId: toolInput.staff_id,
        });
        return JSON.stringify(result);
      }

      case "get_staff": {
        const staff = await getStaffList(businessId);
        return JSON.stringify(staff);
      }

      case "update_lead_status": {
        const result = await updateLeadStatus(
          businessId,
          clientId,
          channel,
          toolInput.status,
          toolInput.reason,
          clientName
        );
        return JSON.stringify(result);
      }

      case "get_my_bookings": {
        // Channel clients use string clientId, convert for booking lookup
        try {
          const bookings = await getClientBookings(businessId, BigInt(clientId));
          return JSON.stringify(bookings);
        } catch {
          return JSON.stringify({ bookings: [], message: "Бронирования не найдены" });
        }
      }

      case "cancel_booking": {
        try {
          const result = await cancelBooking(toolInput.booking_id, BigInt(clientId));
          return JSON.stringify(result);
        } catch {
          return JSON.stringify({ success: false, error: "Не удалось отменить бронирование" });
        }
      }

      case "search_products": {
        const results = await searchProducts(businessId, toolInput.query, toolInput.category);
        return JSON.stringify(results);
      }

      case "create_order": {
        // createOrder expects telegramId: bigint — use BigInt(0) for non-Telegram channels
        const tgId = channel === "telegram" ? BigInt(clientId) : BigInt(0);
        const result = await createOrder(
          businessId,
          tgId,
          toolInput.client_name,
          toolInput.items,
          toolInput.client_phone,
          toolInput.client_address,
          toolInput.payment_method,
          toolInput.notes,
          channel,
          clientId
        );
        return JSON.stringify(result);
      }

      case "get_client_orders": {
        const tgId = channel === "telegram" ? BigInt(clientId) : BigInt(0);
        const result = await getClientOrders(businessId, tgId);
        return JSON.stringify(result);
      }

      case "get_product_details": {
        const result = await getProductDetails(businessId, toolInput.product_id);
        return JSON.stringify(result);
      }

      case "get_categories": {
        const result = await getCategories(businessId);
        return JSON.stringify(result);
      }

      case "list_by_category": {
        const result = await listByCategory(businessId, toolInput.category, toolInput.max_price);
        return JSON.stringify(result);
      }

      case "identify_client": {
        // Sprint 3 step 4: если phone передан — идём по phone (как раньше),
        // это работает для клиентов из CRM/импорта. Если phone пустой —
        // fallback на channel-ID lookup: после Sprint 3 shadow-write и
        // backfill у нас есть Client с whatsappId/instagramId/fbPsid, значит
        // клиент, который написал WA-ботом без явного phone, всё равно
        // идентифицируется как «постоянный».
        const phone = (toolInput.phone || "").trim();
        if (phone) {
          const result = await identifyClientByPhone(businessId, phone);
          return JSON.stringify(result);
        }
        if (channel === "whatsapp" || channel === "instagram" || channel === "facebook") {
          const { identifyClientByChannelId } = await import("@/lib/sales-tools");
          const result = await identifyClientByChannelId(businessId, channel, clientId);
          return JSON.stringify(result);
        }
        return JSON.stringify({ success: false, error: "Нет данных для идентификации" });
      }

      case "get_upsell_suggestions": {
        const result = await getUpsellSuggestions(businessId, toolInput.ordered_product_ids);
        return JSON.stringify(result);
      }

      case "notify_manager": {
        // Используем единую функцию из sales-tools — она:
        //   - всегда создаёт Notification в дашборде (не теряется при отсутствии TG)
        //   - дополнительно пушит в Telegram владельца, если настроен
        // Раньше здесь была inline-реализация, которая молча падала без
        // ownerTelegramChatId и не оставляла никакого следа.
        const { notifyManagerByTelegram } = await import("@/lib/sales-tools");
        // Для канальных клиентов (WA/IG/FB) у нас нет bigint telegramId, передаём 0n —
        // в дашборде видно clientName + channel; внутри функция использует поле только
        // как fallback для подписи "Клиент (ID: ...)".
        const result = await notifyManagerByTelegram(
          businessId,
          BigInt(0),
          toolInput.reason,
          toolInput.client_name,
          toolInput.urgency
        );
        // Persist the escalation as a Task too — same rationale as in
        // src/app/api/telegram/webhook/route.ts: don't lose the lead if
        // the owner misses the Telegram ping. Channel clients have no
        // bigint telegramId so the task lands without a clientId; the
        // title still includes the client name from the AI's tool input.
        const { createEscalationTask } = await import("@/lib/tasks");
        createEscalationTask({
          businessId,
          clientName: toolInput.client_name,
          clientChannel: channel,
          clientChannelId: clientId,
          reason: toolInput.reason || "AI попросил человека",
          urgency: toolInput.urgency,
        }).catch(() => {});
        return JSON.stringify(result);
      }

      case "save_client_note": {
        try {
          const { saveClientNote } = await import("@/lib/channel-memory");
          await saveClientNote(businessId, channel, clientId, toolInput.note_type, toolInput.content);
          return JSON.stringify({ success: true, message: "Заметка сохранена" });
        } catch {
          return JSON.stringify({ success: false, error: "Не удалось сохранить заметку" });
        }
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`[Channel AI] Error in tool ${toolName}:`, error);
    return JSON.stringify({ error: "Ошибка выполнения инструмента" });
  }
}

/**
 * Generate AI response for a WhatsApp/Instagram/FB message.
 * Now supports booking tools for real appointment creation with conflict checking.
 */
export async function generateChannelAIResponse(
  businessId: string,
  channel: string,
  clientId: string,
  userMessage: string,
  clientName?: string
): Promise<string> {
  try {
    console.log(`[Channel AI] START: business=${businessId}, channel=${channel}, clientId=${clientId}, name=${clientName}`);
    const [biz, conv] = await Promise.all([
      loadBusinessProfile(businessId),
      getOrCreateChannelConv(businessId, channel, clientId, clientName),
    ]);
    console.log(`[Channel AI] Conv: id=${conv.id}, historyLen=${((conv.history as unknown[]) || []).length}`);

    if (!biz) return "Извините, произошла ошибка. Пожалуйста, свяжитесь с нами напрямую.";

    // Sprint 3 Step 2: shadow write в единый Client. Помимо ChannelClient
    // (который остаётся для history-совместимости) сразу заводим/обновляем
    // строку в Client через новый helper. Владелец видит WA/IG/FB клиентов
    // в /dashboard/customers, deal-pipeline / loyalty / assigned-staff могут
    // работать с ним через Client.id. ChannelClient уходит на пенсию отдельным
    // backfill-скриптом в Step 4.
    if (channel !== "telegram") {
      try {
        const { findOrCreateClientForChannel } = await import("@/lib/client-identity");
        const ch = channel === "whatsapp" || channel === "instagram" || channel === "facebook"
          ? channel
          : null;
        if (ch) {
          // Для WA `clientId` (waId) обычно = phone без "+"; используем как phone-hint.
          const phoneHint = ch === "whatsapp" ? `+${clientId}` : null;
          findOrCreateClientForChannel({
            businessId,
            channel: ch,
            channelId: clientId,
            name: clientName || null,
            phone: phoneHint,
          }).catch((e) => console.error("[Channel AI] shadow Client write failed:", e));
        }
      } catch (e) {
        // Динамический import мог упасть — не критично, старый path продолжает работать
        console.error("[Channel AI] client-identity import failed:", e);
      }
    }

    // Dispatch message_received CRM event (non-blocking)
    dispatchCrmEvent(businessId, "message_received", {
      client: {
        name: clientName || null,
        phone: null,
        telegramId: channel === "telegram" ? clientId : null,
        totalVisits: 0,
        tags: [],
      },
      message: {
        text: userMessage.substring(0, 500),
        direction: "incoming",
      },
    }).catch((e) => console.error("[CRM] message_received dispatch error:", e));

    // M19: если владелец нажал «Заглушить бота» для этого клиента —
    // возвращаем пустую строку. Не логируем ai_response, не отправляем.
    // Проверяем ChannelClient.botMuted по каналу-специфичному ID.
    try {
      const mutedChannelClient = await prisma.channelClient.findFirst({
        where: {
          businessId,
          OR: [
            { instagramId: clientId },
            { fbPsid: clientId },
            { whatsappPhone: clientId },
          ],
        },
        select: { botMuted: true },
      });
      if (mutedChannelClient?.botMuted) {
        console.log(`[Channel AI] Client ${clientId} (${channel}) is bot-muted — skipping AI`);
        return "";
      }
    } catch {
      // не критично для основного flow
    }

    // Activity log — раньше вызывался только из telegram/webhook, у WA/IG/FB
    // владелец видел пустой журнал в /dashboard/activity. Централизованный
    // вызов здесь покрывает все три канала одним изменением.
    logActivityFireAndForget({
      businessId,
      type: "message_received",
      summary: `Клиент${clientName ? ` ${clientName}` : ""} написал в ${channel}`,
      channel,
      technical: {
        preview: userMessage.substring(0, 120),
      },
    });

    // Lazy document loading (июль 2026): матчер выбирает ТОЛЬКО релевантные
    // документы для текущего вопроса клиента. Ужимает 20-30K токенов «фоновой
    // справки» до 3-5K релевантной. Матчер сам делает fallback на все docs
    // при любой ошибке — качество не роняем.
    //
    // Разбиваем system prompt на ДВА независимо-кэшируемых блока:
    //   systemBase  — стабильная часть (роль, услуги, товары, FAQ, инструкции).
    //                 Кэшируется на 1h — при варьирующемся выборе документов
    //                 продолжает cache-hit'иться.
    //   systemDocs  — блок «Справочные документы» только с выбранными файлами.
    //                 Кэшируется на 5m — при повторе того же запроса hit,
    //                 при смене темы дешёвый write.
    const pickedDocs = await pickRelevantDocuments(userMessage, biz.documents);
    if (pickedDocs.length !== biz.documents.length) {
      console.log(
        `[Channel AI] doc matcher: ${biz.documents.length} → ${pickedDocs.length} for biz=${businessId}`
      );
    }
    const parts = buildChannelSystemPromptParts(biz, channel, pickedDocs);
    let systemBase = parts.base;
    const systemDocs = parts.docs;

    // AI Learning: load client context and corrections (non-blocking on failure)
    try {
      const { buildChannelClientContext, buildClientContextBlock, loadActiveCorrections } = await import("@/lib/channel-memory");
      const [clientContext, corrections] = await Promise.all([
        buildChannelClientContext(businessId, channel, clientId).catch(() => null),
        loadActiveCorrections(businessId).catch(() => ""),
      ]);
      if (clientContext) {
        systemBase += "\n\n" + buildClientContextBlock(clientContext);
      }
      if (corrections) {
        systemBase += "\n\n" + corrections;
      }
    } catch (memErr) {
      console.error("[Channel AI] Memory load error (non-fatal):", memErr);
    }

    // Parse existing history — strip any "— staffix.io" signatures so Claude doesn't copy them
    const history = ((conv.history as HistoryMessage[]) || []).map((m) =>
      m.role === "assistant"
        ? { ...m, content: m.content.replace(/\n+— staffix\.io/g, "").trim() }
        : m
    );

    // База знаний обновилась — жёсткая стратегия защиты от «якорения на истории»
    // (Right Flight case, июль 2026: владелец обновил цены на туры, бот всё равно
    // называл старые из своих же прошлых ответов).
    //
    // Раньше: 10-минутный cooldown + soft warning. Слабо — LLM всё равно
    // предпочитает историю новому промпту, если история длинная.
    // Теперь: ВСЕГДА выкидываем свои прошлые ответы из истории (assistant-ходы),
    // оставляем только вопросы клиента как контекст того что он спрашивал.
    // Плюс жёсткий system-reminder в конце сообщений (LLM больше внимания
    // финалу prompt'а). Это работает для ЛЮБОГО диалога, активный или нет.
    let recentHistory: HistoryMessage[];
    let refreshSoftWarning = false;
    if (conv.needsContextRefresh) {
      // Оставляем ТОЛЬКО реплики клиента — они несут контекст «о чём был разговор»,
      // но не содержат утверждений от бота, которые могли устареть.
      // Берём последние 10 пользовательских реплик — этого достаточно для памяти
      // о контексте, но история становится в 2 раза короче и без «токсичных»
      // ассистент-ответов.
      recentHistory = history.filter((m) => m.role === "user").slice(-10);
      refreshSoftWarning = true;
      console.log(
        `[Channel AI] conv ${conv.id}: knowledge refreshed — kept ${recentHistory.length} user turns, dropped assistant history`
      );

      await prisma.channelConversation.update({
        where: { id: conv.id },
        data: { needsContextRefresh: false },
      }).catch(e => console.error("[Channel AI] reset needsContextRefresh failed:", e));
    } else {
      // Keep last 20 messages to avoid token overflow
      recentHistory = history.slice(-20);
    }

    if (refreshSoftWarning) {
      systemBase += `\n\n⚠️ ВНИМАНИЕ — БАЗА ЗНАНИЙ ОБНОВЛЕНА (правило приоритета фактов)
База знаний этого бизнеса (FAQ / услуги / товары / документы) только что была изменена владельцем. Это перебивает любую информацию, которую ты помнишь о ценах, датах, услугах или остатках товаров.

ИСТОЧНИК ИСТИНЫ для фактов о бизнесе — ТОЛЬКО разделы текущего системного промпта выше:
- "Услуги"/"Каталог товаров"
- "Частые вопросы (FAQ)"
- "Дополнительная информация из документов"

НЕ ИСТОЧНИК фактов (могут содержать устаревшие данные):
- Твои собственные предыдущие ответы в этом диалоге
- Раздел "Резюме предыдущего разговора" / "Что мы обсуждали ранее"
- AI-summary клиента ("этот клиент спрашивал про X")
- Любые упоминания конкретных цен/дат/услуг из памяти

Как применять:
- Если клиент спрашивает "появились ли новые даты?", "сколько сейчас стоит?", "а есть ещё варианты?" — отвечай ТОЛЬКО по разделам FAQ/услуги/документы из промпта. Не по тому, что ты говорил раньше.
- Если ты раньше сказал "одна дата 08.06" а в FAQ теперь три даты — называй ВСЕ ТРИ. Не извиняйся, не упоминай старый ответ — просто дай актуальную информацию.
- Если в саммари написано "клиент спрашивал про X, я ответил Y" — используй это только чтобы понять КОНТЕКСТ запроса, но цифры/факты бери из FAQ заново.
- Контекст разговора (имя, предпочтения, что обсуждали в общем) — сохраняй. Конкретные факты — переспрашивай у промпта.`;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
      ...recentHistory,
      { role: "user", content: userMessage },
    ];

    // Select tools based on business type and consultation flag.
    // - Service mode → bookings only (records appointments).
    // - Sales mode → orders only (sells goods).
    // - Sales mode + consultationsEnabled → both: orders for purchases AND
    //   bookings for free consultations / demos (онлайн-школы, консалтинг).
    const storeTypes = ["store", "shop", "sales", "delivery", "restaurant", "cafe", "flowers", "bakery", "pharmacy"];
    const isStoreBusiness = storeTypes.includes(biz.businessType || "") || (biz.dashboardMode === "sales");
    const tools = isStoreBusiness
      ? (biz.consultationsEnabled ? channelSalesPlusBookingTools : channelSalesTools)
      : channelBookingTools;

    // Hybrid model routing (июль 2026): SIMPLE запросы → Haiku 4.5,
    // COMPLEX → Sonnet 5. Только для бизнесов из AI_HYBRID_BUSINESS_IDS
    // (A/B тестируем на Right Flight). Для остальных — всегда Sonnet 5.
    const mainModel = await pickMainModel(businessId, userMessage);
    console.log(
      `[Channel AI] model=${mainModel.model} complexity=${mainModel.complexity} biz=${businessId}`
    );

    // Call Claude with appropriate tools (with retry on overload).
    // thinking: disabled — на Sonnet 5 adaptive thinking включён по дефолту
    // с effort=high. Для чат-бота это лишние токены на «размышления» — при
    // ответе на «сколько стоит?» модель не должна тратить бюджет на цепочку
    // рассуждений. Отключаем — поведение как у Sonnet 4.5.
    // Для Haiku параметр thinking не применяется — SDK его проигнорирует.
    // max_tokens: 1024 — на Sonnet 5 новый токенайзер даёт ~30% больше токенов
    // на кириллице; бампаем с 800 чтобы не резать ответы про туры.
    //
    // Шаг 2 плана оптимизации (21 июля 2026): умный cache_control.
    // Для sparse traffic write кэша тратит впустую (в 2× дороже чем без него);
    // pickCacheStrategy определяет по активности бизнеса/клиента.
    const cacheStrategy = await pickCacheStrategy(businessId, clientId);
    console.log(`[Channel AI] cache strategy: ${cacheStrategy.reason} → stable=${cacheStrategy.stableTTL} docs=${cacheStrategy.docsTTL ?? "off"}`);
    // system: массив с блоками — base с адаптивным TTL, docs может быть без
    // cache_control если matcher выдаёт разные наборы или бизнес quiet.
    const systemBlocks: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: systemBase,
        cache_control: { type: "ephemeral", ttl: cacheStrategy.stableTTL },
      },
    ];
    if (systemDocs) {
      if (cacheStrategy.docsTTL) {
        systemBlocks.push({
          type: "text",
          text: systemDocs,
          cache_control: { type: "ephemeral", ttl: cacheStrategy.docsTTL },
        });
      } else {
        systemBlocks.push({ type: "text", text: systemDocs });
      }
    }
    // Параметр thinking — только для Sonnet 5. Haiku 4.5 его не поддерживает
    // (по докам это Sonnet/Opus-only feature); если передать — Anthropic 400.
    const mainParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: mainModel.model,
      max_tokens: 1024,
      system: systemBlocks,
      messages,
      tools,
    };
    if (mainModel.model === "claude-sonnet-5") {
      mainParams.thinking = { type: "disabled" };
    }
    let response = await callClaudeWithRetry(mainParams);
    logClaudeUsage(`${channel}/main/${mainModel.complexity}`, response.usage, { biz: businessId, client: clientId, model: mainModel.model });
    // Main Sonnet-ответ — самый дорогой вызов оборота. Трекаем сразу.
    if (response.usage) trackClaudeUsage(businessId, response.usage);

    // Tool loop — process tool_use responses (max 5 iterations)
    let iterations = 0;
    const maxIterations = 5;
    // Все tool-names вызванные за оборот — нужно для safety-net (см. ниже)
    const calledToolNames: string[] = [];

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;

      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );
      for (const b of toolUseBlocks) {
        if (b.type === "tool_use") calledToolNames.push(b.name);
      }

      // Add assistant response to messages
      messages.push({
        role: "assistant",
        content: response.content,
      });

      // Execute each tool call
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolResults: any[] = [];

      for (const block of toolUseBlocks) {
        if (block.type === "tool_use") {
          console.log(`[Channel AI] Tool call: ${block.name} (${channel})`);
          const result = await handleChannelToolCall(
            block.name,
            block.input as Record<string, string>,
            businessId,
            clientId,
            channel,
            clientName
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Add tool results to messages
      messages.push({
        role: "user",
        content: toolResults,
      });

      // Call Claude again with tool results.
      // ЭКСПЕРИМЕНТ (июль 2026): tool-loop итерации на Haiku 4.5 вместо Sonnet.
      // Причина: главный ответ клиенту (первый вызов Sonnet) остаётся качественным,
      // а промежуточные итерации (search_products → check → следующий шаг) — это
      // структурная работа с результатами тулзов, где Haiku справляется на 90%+
      // за 3× меньшую цену ($1/$5 vs $3/$15 per Mtok). Кэши моделей раздельные,
      // поэтому первая итерация будет cache_create на Haiku префиксе — cache-warmer
      // уже прогревает Haiku для активных бизнесов, следующие итерации hit.
      try {
        response = await callClaudeWithRetry({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          // Haiku кэш ОТДЕЛЬНЫЙ от Sonnet-кэша. Передаём те же split-блоки:
          // base кэшируется на 1h (cache-warmer уже прогревает Haiku), docs
          // (если есть) на 5m. Побайтовая совместимость с warmer'ом
          // критична — иначе cache_key разъезжается и warm-hit падает.
          system: systemBlocks,
          messages,
          tools,
        });
        logClaudeUsage(`${channel}/tool-loop-haiku`, response.usage, { biz: businessId, client: clientId, iter: iterations });
        // Каждая итерация — отдельный вызов Claude со своей ценой. Раньше
        // трекали только финальный response, теряли токены итераций tool-loop.
        if (response.usage) trackClaudeUsage(businessId, response.usage);
      } catch (apiError) {
        console.error("[Channel AI] API error after tool execution:", apiError);
        break;
      }
    }

    // (Track усage теперь идёт inline: main Sonnet после первого вызова +
    // каждая Haiku-итерация внутри цикла. Финальный track убран чтобы не
    // double-count последнюю итерацию.)

    // Extract final text response.
    // Фильтруем non-empty text blocks (Claude иногда возвращает `text: ""`).
    // Если ничего не вытащили — идём в recovery-цикл ниже.
    const collectText = (r: Anthropic.Message): string => {
      const parts: string[] = [];
      for (const block of r.content) {
        if (block.type === "text" && block.text && block.text.trim()) {
          parts.push(block.text);
        }
      }
      return parts.join("\n\n").trim();
    };

    let replyText = collectText(response);
    let isFallback = false;

    // Recovery: если по итогам main+tool-loop нет текста, делаем ЕЩЁ ОДИН вызов
    // без tools + с явным push'ем «ответь клиенту текстом». Это защищает от
    // сценариев когда Claude застрял в tool-loop до max iterations и последний
    // response — только tool_use без text, ИЛИ когда API упал внутри цикла.
    if (!replyText) {
      const reason =
        response.stop_reason === "tool_use"
          ? `tool_loop_exhausted (iterations=${iterations}/${maxIterations})`
          : `empty_text (stop=${response.stop_reason})`;
      console.warn(
        `[Channel AI] EMPTY RESPONSE — attempting recovery. reason=${reason} biz=${businessId} channel=${channel}`
      );

      try {
        // Sonnet 5, без tools — Claude обязан вернуть текст.
        // messages уже содержит user turn + [tool_use, tool_result]* — добавляем
        // финальный user-nudge чтобы модель точно сгенерировала ответ клиенту.
        const recoveryMessages: Anthropic.MessageParam[] = [
          ...messages,
          {
            role: "user" as const,
            content:
              "Пожалуйста, ответь клиенту простым текстом одним-двумя предложениями. " +
              "Не вызывай инструменты. Используй уже собранную информацию из контекста.",
          },
        ];
        const recovery = await callClaudeWithRetry({
          model: "claude-sonnet-5",
          max_tokens: 400,
          thinking: { type: "disabled" },
          system: systemBlocks,
          messages: recoveryMessages,
          // tools намеренно опущены — форсируем текст.
        });
        logClaudeUsage(`${channel}/recovery`, recovery.usage, {
          biz: businessId,
          client: clientId,
          orig_reason: reason,
        });
        replyText = collectText(recovery);
        if (replyText) {
          console.log(`[Channel AI] RECOVERY succeeded: "${replyText.slice(0, 80)}"`);
        }
      } catch (recoveryErr) {
        console.error(`[Channel AI] RECOVERY failed:`, recoveryErr);
      }
    }

    // Финальный fallback — если даже recovery не помогла. НЕЙТРАЛЬНАЯ формулировка,
    // не апологетическая «не удалось» (та фраза раньше сохранялась в историю и
    // Claude начинал её повторять). Плюс помечаем isFallback=true чтобы НЕ
    // сохранять её в conversation history — не заражаем диалог.
    if (!replyText) {
      replyText = "Секундочку, я уточню детали. Задайте, пожалуйста, вопрос по нашим услугам ещё раз.";
      isFallback = true;
      console.error(
        `[Channel AI] FALLBACK reached — no text after recovery. biz=${businessId} channel=${channel} stop_reason=${response.stop_reason} iters=${iterations}`
      );
    }

    // SAFETY NET: два триггера для гарантированной эскалации к владельцу:
    //  1) Бот в тексте обещал «передам менеджеру» / «свяжемся» — regex.
    //  2) Клиент только что прислал НОВЫЙ телефон (raньше в ChannelClient.phone
    //     не было). Ловит кейс где бот на Turn 1 просит номер (regex fires),
    //     на Turn 2 клиент присылает "+998...", бот отвечает "спасибо" (regex
    //     не срабатывает) — раньше телефон терялся молча, теперь уведомим.
    // Зеркалит логику TG webhook через единый detector.
    const { botPromisedHandoffRegex } = await import("@/lib/handoff-detector");
    const { extractPhone } = await import("@/lib/ai-memory");
    const promisedForwardingRegex = botPromisedHandoffRegex();
    const calledNotifyManagerCh = calledToolNames.includes("notify_manager");
    const extractedPhoneCh = extractPhone(userMessage);

    // Был ли у клиента телефон до этого сообщения? Смотрим в ChannelClient.
    // (Смотрим ВСЕГДА — не только когда клиент прислал телефон в этом turn'e —
    //  чтобы hard-code guard ниже мог решить: перехватывать промис или нет.)
    let channelClientPhoneOnRecord: string | null = null;
    let channelClientRowId: string | null = null;  // для последующего phone-persist ниже
    try {
      const existing = await prisma.channelClient.findFirst({
        where: {
          businessId,
          OR: [
            { instagramId: clientId },
            { fbPsid: clientId },
            { whatsappPhone: clientId },
          ],
        },
        select: { id: true, phone: true },
      });
      channelClientPhoneOnRecord = existing?.phone ?? null;
      channelClientRowId = existing?.id ?? null;
    } catch {
      // не критично
    }

    // B10: клиент прислал новый телефон — сохраняем в ChannelClient.phone.
    // Раньше этого не делалось: safety-net эскалировала «новый контакт» на
    // каждом сообщении с номером, потому что при следующем turn'e phone
    // всё ещё null. Теперь дубликаты уведомлений уходят.
    if (extractedPhoneCh && extractedPhoneCh !== channelClientPhoneOnRecord && channelClientRowId) {
      prisma.channelClient.update({
        where: { id: channelClientRowId },
        data: { phone: extractedPhoneCh },
      }).catch((e) => console.error("[Channel AI] Failed to persist client phone:", e));
      // Обновляем локальную переменную — hard-code guard ниже должен видеть
      // что у нас теперь есть телефон, чтобы не перехватывать answer.
      channelClientPhoneOnRecord = extractedPhoneCh;
    }
    const channelClientHadPhoneBefore = !!channelClientPhoneOnRecord;
    const newContactProvidedCh = !!extractedPhoneCh && !channelClientHadPhoneBefore;
    const hasPhoneNowCh = !!(extractedPhoneCh || channelClientPhoneOnRecord);
    const botPromisedCh = promisedForwardingRegex.test(replyText);

    // ⚠️ HARD-CODE GUARD (июль 2026, AY 16 июля):
    // Промпт-правило (fabc9fe) уменьшает частоту протечек, но не убирает их.
    // Если бот ВСЁ ЖЕ пообещал «менеджер свяжется», НЕ вызвал notify_manager
    // (значит это не осознанная эскалация клиента-жалобщика), И у нас нет
    // телефона — ПЕРЕХВАТЫВАЕМ ответ. Клиент видит просьбу дать номер вместо
    // ложного обещания. Эскалацию не отправляем — менеджер отработает когда
    // телефон реально придёт (тогда сработает newContactProvidedCh trigger).
    //
    // Это защита от потери лидов: без guard'а бот говорил «свяжемся», клиент
    // ждал, но менеджеру нечем было связаться. С guard'ом клиент видит нормальный
    // запрос телефона.
    let promiseIntercepted = false;
    if (botPromisedCh && !calledNotifyManagerCh && !hasPhoneNowCh) {
      console.warn(
        `[Channel AI] HARD-CODE GUARD: prompt leaked promise without phone — intercepting. business=${businessId} channel=${channel}`
      );
      replyText =
        "Отлично! Чтобы менеджер мог с Вами связаться и всё подробно рассказать — " +
        "подскажите, пожалуйста, Ваш номер телефона и удобное время для звонка.";
      promiseIntercepted = true;
    }

    const shouldNotifyCh = !calledNotifyManagerCh && !promiseIntercepted && (
      promisedForwardingRegex.test(replyText) || newContactProvidedCh
    );

    if (shouldNotifyCh) {
      const trigger = newContactProvidedCh ? "new-contact" : "handoff-promise";

      // Данные телефона взяли выше (channelClientPhoneOnRecord + extractedPhoneCh
      // + hasPhoneNowCh) — не дублируем запрос. После добавления HARD-CODE GUARD
      // ветка handoff-promise без телефона фактически не должна доходить сюда
      // (guard перехватил бы), но оставляем защитную логику на случай race
      // conditions или неожиданных путей.
      const existingClientPhone = channelClientPhoneOnRecord;
      const hasPhone = hasPhoneNowCh;
      const missingPhoneForHandoff = trigger === "handoff-promise" && !hasPhone;

      console.warn(
        `[Channel AI] SAFETY NET: ${trigger} — invoking notify_manager. business=${businessId} channel=${channel} hasPhone=${hasPhone} missingPhone=${missingPhoneForHandoff}`
      );

      try {
        const { notifyManagerByTelegram } = await import("@/lib/sales-tools");

        // Контекст: предыдущее сообщение бота из истории + текущее клиента + телефон.
        // Без этого владелец видит "+998..." без понимания зачем звонить.
        const history = (conv.history as HistoryMessage[]) || [];
        const prevAssistantTurn = history
          .filter((m) => m.role === "assistant")
          .slice(-1)[0]?.content?.slice(0, 300);

        const contextLines: string[] = [`Канал: ${channel}`];
        if (prevAssistantTurn) contextLines.push(`Бот ранее: ${prevAssistantTurn}`);
        contextLines.push(`Клиент: ${userMessage.slice(0, 400)}`);
        if (extractedPhoneCh) {
          contextLines.push(`Телефон: ${extractedPhoneCh}`);
        } else if (existingClientPhone) {
          contextLines.push(`Телефон (ранее): ${existingClientPhone}`);
        }

        let label: string;
        if (newContactProvidedCh) {
          label = "[новый контакт от клиента]";
        } else if (missingPhoneForHandoff) {
          label =
            "⚠️ [БЕЗ ТЕЛЕФОНА] Бот пообещал что менеджер свяжется, но НЕ собрал номер клиента.\n" +
            "Ответьте клиенту в " +
            (channel === "instagram" ? "Instagram DM"
              : channel === "whatsapp" ? "WhatsApp"
              : channel === "facebook" ? "Facebook Messenger"
              : "канале") +
            " — запросите телефон, потом позвоните.";
        } else {
          label = "[авто-эскалация после обещания бота]";
        }
        const reason = `${label}\n${contextLines.join("\n")}`;

        const urgency = missingPhoneForHandoff ? "urgent" : "normal";
        await notifyManagerByTelegram(
          businessId,
          BigInt(0),
          reason,
          clientName,
          urgency,
          // B13 частичный fix: чтобы Notification.metadata содержала реальный
          // канал+ID клиента вместо фейкового telegramId=0.
          { channel, channelClientId: clientId },
        );

        // Также создаём Task чтобы менеджер видел эту эскалацию в дашборде,
        // не только в TG-пуше (июль 2026 — раньше safety-net'ы генерировали
        // Notification, но НЕ Task; поэтому в /dashboard задач было мало
        // по сравнению с реальным потоком эскалаций).
        const { createEscalationTask } = await import("@/lib/tasks");
        createEscalationTask({
          businessId,
          clientChannel: channel,
          clientChannelId: clientId,
          clientName,
          reason,
          urgency,
        }).catch(() => {});
      } catch (e) {
        console.error("[Channel AI] SAFETY NET notify_manager failed:", e);
      }
    }

    // Check soft message limit (warn business owner at 80%, once)
    const sub = await prisma.subscription.findUnique({
      where: { businessId },
      select: { messagesUsed: true, messagesLimit: true, limitWarning80Sent: true },
    });
    if (sub && sub.messagesLimit !== -1 && sub.messagesLimit > 0) {
      const usage = sub.messagesUsed / sub.messagesLimit;
      if (usage >= 0.8 && !sub.limitWarning80Sent) {
        // Mark as sent first to prevent duplicate emails
        await prisma.subscription.update({
          where: { businessId },
          data: { limitWarning80Sent: true },
        });
        // Send email to business owner
        const owner = await prisma.business.findUnique({
          where: { id: businessId },
          select: { name: true, user: { select: { email: true, name: true } } },
        });
        if (owner?.user?.email) {
          const remaining = sub.messagesLimit - sub.messagesUsed;
          sendLimitWarningEmail(
            owner.user.email,
            owner.user.name,
            owner.name,
            sub.messagesUsed,
            sub.messagesLimit,
            remaining
          ).catch((e) => console.error("[Channel AI] Limit warning email error:", e));
        }
        console.warn(`[Channel AI] Business ${businessId}: 80% limit reached (${sub.messagesUsed}/${sub.messagesLimit}), email sent`);
      }
    }

    // Save only text messages to history (not tool_use/tool_result blocks)
    // Strip "— staffix.io" signature from history so Claude doesn't copy it.
    //
    // Если replyText — фолбэк (recovery не сработала, ответ клиенту нейтральный
    // «уточню детали»), НЕ сохраняем этот ответ бота в историю. Иначе Claude
    // при следующем turn'e видит его в контексте и может начать копировать
    // «уточню детали» / «извините» вместо реальных ответов. User-turn сохраняем —
    // это факт что клиент писал (важно для message counter'а и для контекста).
    const replyForHistory = replyText.replace(/\n\n— staffix\.io$/g, "").trim();
    const historyEntries: HistoryMessage[] = [
      ...history,
      { role: "user" as const, content: userMessage },
    ];
    if (!isFallback) {
      historyEntries.push({ role: "assistant" as const, content: replyForHistory });
    } else {
      console.warn(
        `[Channel AI] FALLBACK detected — NOT saving assistant reply to history. conv=${conv.id}`
      );
    }
    const updatedHistory = historyEntries.slice(-40); // keep last 40 messages

    try {
      await prisma.channelConversation.update({
        where: { id: conv.id },
        data: {
          history: updatedHistory,
          messageCount: { increment: 1 },
          clientName: clientName || conv.clientName,
        },
      });
      console.log(`[Channel AI] SAVED: conv=${conv.id}, newHistoryLen=${updatedHistory.length}`);

      // AI Learning: flag for summary every 10 messages
      if ((conv.messageCount + 1) % 10 === 0) {
        prisma.channelConversation.update({
          where: { id: conv.id },
          data: { needsSummary: true },
        }).catch(() => {});
      }
    } catch (saveErr) {
      console.error(`[Channel AI] SAVE FAILED: conv=${conv.id}`, saveErr);
    }

    logActivityFireAndForget({
      businessId,
      type: "ai_response",
      summary: `AI ответил клиенту в ${channel}`,
      channel,
      technical: { preview: replyText.substring(0, 120) },
    });

    return replyText;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`Channel AI error (${channel}):`, errMsg);
    logActivityFireAndForget({
      businessId,
      type: "error",
      severity: "error",
      summary: `Ошибка ответа AI в ${channel}`,
      channel,
      technical: { error: errMsg },
    });

    // Specific message for Anthropic overload (529)
    if (errMsg.includes("overloaded") || errMsg.includes("529")) {
      return "Извините, сервер AI временно перегружен. Пожалуйста, попробуйте через 1-2 минуты.";
    }

    return "Извините, произошла техническая ошибка. Пожалуйста, напишите нам позже.";
  }
}

/**
 * Send email warning when business reaches 80% of message limit
 */
async function sendLimitWarningEmail(
  email: string,
  userName: string,
  businessName: string,
  used: number,
  limit: number,
  remaining: number
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: process.env.FROM_EMAIL || "Staffix <noreply@staffix.io>",
    to: email,
    subject: `⚠️ ${businessName}: осталось ${remaining} сообщений из ${limit}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">Лимит сообщений почти исчерпан</h2>
        <p>Здравствуйте, ${userName}!</p>
        <p>Ваш AI-бот для <strong>${businessName}</strong> использовал <strong>${used} из ${limit}</strong> сообщений (${Math.round((used / limit) * 100)}%).</p>
        <p>Осталось: <strong>${remaining} сообщений</strong>.</p>
        <p>Когда лимит будет исчерпан, бот перестанет отвечать клиентам.</p>
        <a href="https://www.staffix.io/dashboard/subscription"
           style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 12px;">
          Увеличить лимит
        </a>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">— Команда Staffix</p>
      </div>
    `,
  });
}

/**
 * Pre-warm the Anthropic prompt cache for a (business, channel) pair.
 *
 * Why: Anthropic per docs — "The cache is refreshed for no additional cost
 * each time the cached content is used". TTL is 1h; a successful cache_read
 * extends the timer. If we touch the cache every ~30 min, it stays warm
 * indefinitely — production calls never pay cache_create (~$0.18 each for
 * Right Flight-sized 30K prefix).
 *
 * The call is minimal:
 *  - system   = the EXACT same buildChannelSystemPrompt output that
 *               production uses (so the cache key matches byte-for-byte)
 *  - messages = single "ping" user message
 *  - max_tokens = 1 (we don't care about the reply)
 *  - tools    = omitted (warming the cache, not invoking AI)
 *
 * Returns usage so the cron can log how many tokens were read vs. created.
 */
export async function warmChannelCache(
  businessId: string,
  channel: string
): Promise<Anthropic.Message["usage"] | null> {
  const biz = await loadBusinessProfile(businessId);
  if (!biz) return null;

  // Warmer греет ТОЛЬКО базовый блок (1h TTL). Docs-блок в проде варьируется
  // от запроса к запросу через lazy-loading (см. pickRelevantDocuments), греть
  // его бессмысленно — cache_key будет другой на реальном трафике.
  // Пустой массив docSubset → docs = "" → в warmer уходит только base.
  const parts = buildChannelSystemPromptParts(biz, channel, []);
  if (parts.base.length < 4096) return null;

  // Побитово-идентичные cache-блоки production'а. КРИТИЧНО: если поля
  // (thinking / cache_control / модель / max_tokens) не совпадают —
  // cache_key разный, warm-hit = 0%.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: parts.base,
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];

  // Anthropic кэш раздельный по моделям. Мы используем ДВЕ модели в проде:
  // - Sonnet 5 на главный ответ клиенту (первый вызов Claude)
  // - Haiku 4.5 на tool-loop итерации (после того как бот вызвал инструмент)
  // Греем оба кэша параллельно.
  const [sonnetUsage] = await Promise.all([
    callClaudeWithRetry({
      model: "claude-sonnet-5",
      max_tokens: 1,
      thinking: { type: "disabled" },
      system: systemBlocks,
      messages: [{ role: "user" as const, content: "ping" }],
    }).then((r) => {
      logClaudeUsage(`warm/${channel}/sonnet`, r.usage, { biz: businessId });
      return r.usage;
    }).catch((e) => {
      console.error(`[warm/sonnet] biz=${businessId}:`, e);
      return null;
    }),
    callClaudeWithRetry({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      system: systemBlocks,
      messages: [{ role: "user" as const, content: "ping" }],
    }).then((r) => {
      logClaudeUsage(`warm/${channel}/haiku`, r.usage, { biz: businessId });
      return r.usage;
    }).catch((e) => {
      console.error(`[warm/haiku] biz=${businessId}:`, e);
      return null;
    }),
  ]);

  return sonnetUsage;
}

