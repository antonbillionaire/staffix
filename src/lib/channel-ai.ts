/**
 * AI response engine for WhatsApp, Instagram DM, and Facebook Messenger channels.
 * Now includes booking tools (check_availability, create_booking, etc.)
 * so all channels share the same booking database with conflict checking
 * and notifications.
 */

import Anthropic from "@anthropic-ai/sdk";
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
} from "@/lib/sales-tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type HistoryMessage = { role: "user" | "assistant"; content: string };

// Channel booking tools — subset of full booking tools + lead qualification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const channelBookingTools: any[] = bookingToolDefinitions.filter(
  (t: { name: string }) =>
    ["check_availability", "create_booking", "get_services", "get_staff", "update_lead_status", "get_my_bookings", "cancel_booking", "notify_manager", "search_products"].includes(t.name)
);

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
      staff: { select: { name: true, role: true }, take: 10 },
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
    ? biz.staff.map((s) => `- ${s.name}${s.role ? ` (${s.role})` : ""}`).join("\n")
    : "";

  const faqList = biz.faqs.length > 0
    ? biz.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "";

  const botName = biz.botDisplayName || "AI-помощник";
  let prompt = `Ты — ${botName} бизнеса «${biz.name}» в ${channelName}. Твоя задача — вежливо и точно отвечать на вопросы клиентов, помогать с записью и информацией об услугах. Общайся ${tone} тоном.${biz.botDisplayName ? ` Тебя зовут ${biz.botDisplayName}, представляйся этим именем.` : ""}`;

  if (biz.address) prompt += `\n\nАдрес: ${biz.address}`;
  if (biz.phone) prompt += `\nТелефон: ${biz.phone}`;
  if (biz.workingHours) prompt += `\nРежим работы: ${biz.workingHours}`;
  if (biz.city) prompt += `\nГород: ${biz.city}`;

  prompt += `\n\nУслуги:\n${servicesList}`;

  if (productsList) prompt += `\n\nТовары:\n${productsList}`;

  if (staffList) prompt += `\n\nСпециалисты:\n${staffList}`;

  if (faqList) prompt += `\n\nЧасто задаваемые вопросы:\n${faqList}`;

  // Add knowledge base documents with chunking (total limit 50000 chars)
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
    prompt += `\n\nДокументы базы знаний:\n${docParts.join("\n\n")}`;
  }

  if (biz.welcomeMessage) {
    prompt += `\n\nПриветственное сообщение для новых клиентов:\n${biz.welcomeMessage}`;
  }

  if (biz.aiRules) {
    prompt += `\n\nВажные правила:\n${biz.aiRules}`;
  }

  prompt += `\n\nУ тебя есть инструменты для записи клиентов. Когда клиент хочет записаться:
1. Уточни имя, желаемую услугу, мастера (если важно) и удобную дату
2. Проверь доступные слоты через check_availability
3. Предложи свободное время
4. После подтверждения клиентом — создай запись через create_booking
Записи создаются автоматически, клиенту не нужно звонить.

Квалификация лидов — после каждого сообщения оцени статус клиента и вызови update_lead_status если статус изменился:
- cold: первое обращение, общий вопрос, приветствие
- warm: интерес к конкретной услуге, спрашивает цены, детали, расписание
- hot: хочет записаться, обсуждает конкретное время, готов к покупке
- client: записался или купил услугу
Статус можно только повышать, никогда не понижай. Вызывай update_lead_status тихо, не сообщай клиенту о квалификации.

Если в каталоге есть несколько позиций с одинаковым или похожим названием (разные размеры, характеристики, варианты) — ВСЕГДА показывай ВСЕ варианты клиенту и уточняй, какой именно нужен. Используй описания из каталога и базы знаний, чтобы объяснить разницу между вариантами.

Если клиент спрашивает о товаре, которого нет в списке выше, или если нужно найти товар по ключевому слову или категории — используй инструмент search_products. Он ищет по всей базе товаров (не только по тем, что в списке выше).

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
  channel: string
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
          toolInput.reason
        );
        return JSON.stringify(result);
      }

      case "get_my_bookings": {
        // Channel clients use string clientId, convert for Telegram-based booking lookup
        const bookings = await getClientBookings(businessId, BigInt(clientId));
        return JSON.stringify(bookings);
      }

      case "cancel_booking": {
        const result = await cancelBooking(toolInput.booking_id, BigInt(clientId));
        return JSON.stringify(result);
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

      case "get_upsell_suggestions": {
        const result = await getUpsellSuggestions(businessId, toolInput.ordered_product_ids);
        return JSON.stringify(result);
      }

      case "notify_manager": {
        // Send notification to business owner about client needing human help
        const business = await prisma.business.findUnique({
          where: { id: businessId },
          select: { ownerTelegramChatId: true, botToken: true, name: true },
        });
        if (business?.ownerTelegramChatId && business?.botToken) {
          const urgencyLabel = toolInput.urgency === "urgent" ? "🔴 СРОЧНО" : "📩";
          const message = `${urgencyLabel} Запрос от клиента\n\nКлиент: ${toolInput.client_name || "Неизвестен"}\nКанал: ${channel}\nПричина: ${toolInput.reason}`;
          fetch(`https://api.telegram.org/bot${business.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: business.ownerTelegramChatId.toString(),
              text: message,
            }),
          }).catch((e) => console.error("[Channel AI] notify_manager error:", e));
        }
        return JSON.stringify({ success: true, message: "Менеджер уведомлён" });
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
    const [biz, conv] = await Promise.all([
      loadBusinessProfile(businessId),
      getOrCreateChannelConv(businessId, channel, clientId, clientName),
    ]);

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

    const systemPrompt = buildChannelSystemPrompt(biz, channel);

    // Parse existing history
    const history = (conv.history as HistoryMessage[]) || [];

    // Keep last 20 messages to avoid token overflow
    const recentHistory = history.slice(-20);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
      ...recentHistory,
      { role: "user", content: userMessage },
    ];

    // Select tools based on business type
    const isStoreBusiness = biz.businessType === "store" || biz.businessType === "shop" || biz.businessType === "sales";
    const tools = isStoreBusiness ? channelSalesTools : channelBookingTools;

    // Call Claude with appropriate tools
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools,
    });

    // Tool loop — process tool_use responses (max 5 iterations)
    let iterations = 0;
    const maxIterations = 5;

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;

      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

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
            channel
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
        response = await anthropic.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          tools: channelBookingTools,
        });
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

    // Add "Powered by Staffix" signature for free/starter plans
    if (biz) {
      const bizSettings = await prisma.business.findUnique({
        where: { id: businessId },
        select: { hidePoweredBy: true },
      });
      if (!bizSettings?.hidePoweredBy) {
        replyText += "\n\n— staffix.io";
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
    const updatedHistory = ([
      ...history,
      { role: "user" as const, content: userMessage },
      { role: "assistant" as const, content: replyText },
    ] as HistoryMessage[]).slice(-40); // keep last 40 messages

    await prisma.channelConversation.update({
      where: { id: conv.id },
      data: {
        history: updatedHistory,
        messageCount: { increment: 1 },
        clientName: clientName || conv.clientName,
      },
    });

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
