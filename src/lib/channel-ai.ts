/**
 * AI response engine for WhatsApp, Instagram DM, and Facebook Messenger channels.
 * Now includes booking tools (check_availability, create_booking, etc.)
 * so all channels share the same booking database with conflict checking
 * and notifications.
 */

import { prisma } from "@/lib/prisma";
import { dispatchCrmEvent } from "@/lib/crm-integrations";
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
import { callClaudeWithRetry, logClaudeUsage } from "@/lib/claude-retry";
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
      ["check_availability", "create_booking", "get_services", "get_staff", "update_lead_status", "get_my_bookings", "cancel_booking", "notify_manager", "search_products"].includes(t.name)
  ),
  saveClientNoteTool,
];

// Channel sales tools — for store/shop businesses (create_order, get_client_orders + shared tools)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const channelSalesTools: any[] = [
  ...salesToolDefinitions.filter(
    (t: { name: string }) =>
      ["search_products", "get_product_details", "get_categories", "create_order", "get_client_orders", "get_upsell_suggestions"].includes(t.name)
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
      ["search_products", "get_product_details", "get_categories", "create_order", "get_client_orders", "get_upsell_suggestions"].includes(t.name)
  ),
  ...bookingToolDefinitions.filter(
    (t: { name: string }) =>
      ["check_availability", "create_booking", "get_services", "get_staff", "update_lead_status", "get_my_bookings", "cancel_booking", "notify_manager"].includes(t.name)
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
      documents: { where: { parsed: true }, select: { name: true, extractedText: true }, take: 10 },
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

  const botName = biz.botDisplayName || "AI-помощник";
  let prompt = `${ANTI_PROBE_USER_BOT}

Ты — ${botName}, AI-сотрудник бизнеса «${biz.name}» в ${channelName}.

КРИТИЧЕСКИ ВАЖНО: Твоё имя — ${botName}. ВСЕГДА представляйся как ${botName}. Если клиент спрашивает как тебя зовут — отвечай "${botName}". Никогда не используй другое имя.

${biz.aiRules ? `## ⭐ ПРАВИЛА ОТ ВЛАДЕЛЬЦА БИЗНЕСА — ВЫСШИЙ ПРИОРИТЕТ
Эти правила задал владелец в настройках. Они перебивают любые рекомендации ниже по тексту (длине ответов, стилю, формулировкам). Если рекомендация ниже противоречит правилу — следуй правилу.

${biz.aiRules}

` : ""}## ДЛИНА ОТВЕТА (по умолчанию)
Ответ — 1–3 коротких предложения, обычно до 400 символов. Люди в мессенджерах не пишут простыни — отвечай так же. Длиннее можно ТОЛЬКО если клиент сам просит подробности или нужно перечислить варианты. Если владелец задал другую длину в правилах выше — следуй ему.

Твоя задача — вежливо и точно отвечать на вопросы клиентов, помогать с записью и информацией об услугах. Общайся ${tone} тоном.

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

  // Add knowledge base documents with chunking (total limit 50000 chars).
  // FAQ ставится ПОСЛЕ документов и помечается как приоритетный источник —
  // без этого Claude часто отдаёт предпочтение длинным структурированным
  // документам, даже когда FAQ содержит более свежую информацию.
  const MAX_DOCS_TOTAL_CHARS = 50000;
  const docsWithText = biz.documents.filter((d) => d.extractedText && d.extractedText.length > 0);
  if (docsWithText.length > 0) {
    const docParts: string[] = [];
    let totalChars = 0;
    for (const d of docsWithText) {
      const fullText = d.extractedText!;
      const remaining = MAX_DOCS_TOTAL_CHARS - totalChars;
      if (remaining <= 0) break;
      const text = fullText.length > remaining ? fullText.substring(0, remaining) + "..." : fullText;
      docParts.push(`### ${d.name}:\n${text}`);
      totalChars += text.length;
    }
    prompt += `\n\nСправочные документы (фоновая информация — могут содержать устаревшие данные):\n${docParts.join("\n\n")}`;
  }

  if (faqList) {
    prompt += `\n\n⭐ FAQ — АКТУАЛЬНАЯ ИНФОРМАЦИЯ ОТ ВЛАДЕЛЬЦА (главный источник правды):\n${faqList}`;
    prompt += `\n\n🔑 ПРИОРИТЕТ ФАКТОВ (КРИТИЧНО):
- FAQ выше — самый свежий источник, владелец обновляет его вручную при изменении цен/дат/правил.
- Справочные документы — фоновая информация, может содержать устаревшие данные (старые прайс-листы, прошлогодние программы туров и т.п.).
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

  return prompt;
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
        // Канальный клиент не имеет Telegram ID — авто-привязка не сработает,
        // но lookup по телефону всё равно даст знание о статусе клиента.
        const result = await identifyClientByPhone(businessId, toolInput.phone);
        return JSON.stringify(result);
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

    let systemPrompt = buildChannelSystemPrompt(biz, channel);

    // AI Learning: load client context and corrections (non-blocking on failure)
    try {
      const { buildChannelClientContext, buildClientContextBlock, loadActiveCorrections } = await import("@/lib/channel-memory");
      const [clientContext, corrections] = await Promise.all([
        buildChannelClientContext(businessId, channel, clientId).catch(() => null),
        loadActiveCorrections(businessId).catch(() => ""),
      ]);
      if (clientContext) {
        systemPrompt += "\n\n" + buildClientContextBlock(clientContext);
      }
      if (corrections) {
        systemPrompt += "\n\n" + corrections;
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

    // База знаний обновилась — стратегия зависит от того, активен ли диалог.
    // Если диалог "остыл" (последнее сообщение давно) — обнуляем историю.
    // Если активный — историю сохраняем, но добавляем мягкое предупреждение
    // в системный промпт, чтобы бот не повторял свои прошлые ответы автоматически.
    const CONTEXT_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
    let recentHistory: HistoryMessage[];
    let refreshSoftWarning = false;
    if (conv.needsContextRefresh) {
      const lastTouchedAt = conv.updatedAt instanceof Date
        ? conv.updatedAt.getTime()
        : new Date(conv.updatedAt).getTime();
      const isActive =
        Number.isFinite(lastTouchedAt) &&
        Date.now() - lastTouchedAt < CONTEXT_REFRESH_COOLDOWN_MS;

      if (isActive) {
        recentHistory = history.slice(-20);
        refreshSoftWarning = true;
        console.log(`[Channel AI] Active conv ${conv.id}: keeping history, soft warning enabled`);
      } else {
        recentHistory = [];
        console.log(`[Channel AI] Cold conv ${conv.id}: history trimmed (knowledge base updated)`);
      }

      await prisma.channelConversation.update({
        where: { id: conv.id },
        data: { needsContextRefresh: false },
      }).catch(e => console.error("[Channel AI] reset needsContextRefresh failed:", e));
    } else {
      // Keep last 20 messages to avoid token overflow
      recentHistory = history.slice(-20);
    }

    if (refreshSoftWarning) {
      systemPrompt += `\n\n⚠️ ВНИМАНИЕ — БАЗА ЗНАНИЙ ОБНОВЛЕНА (правило приоритета фактов)
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

    // Call Claude with appropriate tools (with retry on overload)
    let response = await callClaudeWithRetry({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      system: systemPrompt,
      messages,
      tools,
    });
    logClaudeUsage(`${channel}/main`, response.usage, { biz: businessId, client: clientId });

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

      // Call Claude again with tool results
      try {
        response = await callClaudeWithRetry({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 500,
          system: systemPrompt,
          messages,
          tools,
        });
        logClaudeUsage(`${channel}/tool-loop`, response.usage, { biz: businessId, client: clientId, iter: iterations });
      } catch (apiError) {
        console.error("[Channel AI] API error after tool execution:", apiError);
        break;
      }
    }

    // Track Claude API token usage
    if (response.usage) {
      prisma.business.update({
        where: { id: businessId },
        data: {
          tokensUsedInput: { increment: response.usage.input_tokens },
          tokensUsedOutput: { increment: response.usage.output_tokens },
        },
      }).catch((e) => console.error("[Channel AI] Token tracking error:", e));
    }

    // Extract final text response
    const textBlocks = response.content.filter((block) => block.type === "text");
    let replyText = textBlocks.length > 0 && textBlocks[0].type === "text"
      ? textBlocks[0].text
      : "Извините, не удалось сформировать ответ. Пожалуйста, попробуйте ещё раз.";

    // SAFETY NET: если бот в тексте обещал «передал менеджеру» но
    // notify_manager в этом обороте не вызывался — зовём его сами.
    // Зеркалит логику Telegram webhook через единый detector.
    const { botPromisedHandoffRegex } = await import("@/lib/handoff-detector");
    const promisedForwardingRegex = botPromisedHandoffRegex();
    if (
      !calledToolNames.includes("notify_manager") &&
      promisedForwardingRegex.test(replyText)
    ) {
      console.warn(
        `[Channel AI] SAFETY NET: bot promised forwarding without calling notify_manager — invoking automatically. business=${businessId} channel=${channel}`
      );
      try {
        const { notifyManagerByTelegram } = await import("@/lib/sales-tools");
        await notifyManagerByTelegram(
          businessId,
          BigInt(0),
          `[авто-эскалация после обещания бота, канал ${channel}] ${userMessage.slice(0, 400)}`,
          clientName,
          "normal"
        );
      } catch (e) {
        console.error("[Channel AI] SAFETY NET notify_manager failed:", e);
      }
    }

    // "— staffix.io" signature for free/starter plans temporarily disabled
    // on Антон's request (June 2026) — looked like leftover SaaS-template
    // branding inside the client's own bot, confusing real customers. Re-enable
    // later as a proper opt-in (e.g. only on Trial, never on paid). Original
    // logic kept here as a reference for quick restore:
    //   const bizSettings = await prisma.business.findUnique({
    //     where: { id: businessId }, select: { hidePoweredBy: true },
    //   });
    //   if (!bizSettings?.hidePoweredBy) replyText += "\n\n— staffix.io";

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
    // Strip "— staffix.io" signature from history so Claude doesn't copy it
    const replyForHistory = replyText.replace(/\n\n— staffix\.io$/g, "").trim();
    const updatedHistory = ([
      ...history,
      { role: "user" as const, content: userMessage },
      { role: "assistant" as const, content: replyForHistory },
    ] as HistoryMessage[]).slice(-40); // keep last 40 messages

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

    return replyText;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`Channel AI error (${channel}):`, errMsg);

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

  const systemPrompt = buildChannelSystemPrompt(biz, channel);
  // Если префикс короткий — кэширование не сэкономит, не зовём Claude.
  if (systemPrompt.length < 4096) return null;

  const response = await callClaudeWithRetry({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1,
    system: systemPrompt,
    messages: [{ role: "user", content: "ping" }],
  });

  logClaudeUsage(`warm/${channel}`, response.usage, { biz: businessId });
  return response.usage;
}
