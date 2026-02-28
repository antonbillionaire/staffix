/**
 * AI response engine for WhatsApp, Instagram DM, and Facebook Messenger channels.
 * Now includes booking tools (check_availability, create_booking, etc.)
 * so all channels share the same booking database with conflict checking
 * and notifications.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  bookingToolDefinitions,
  checkAvailability,
  createBookingFromChannel,
  getServicesList,
  getStaffList,
} from "@/lib/booking-tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type HistoryMessage = { role: "user" | "assistant"; content: string };

// Channel booking tools — subset of full booking tools (no cancel, no get_my_bookings, no notify_manager)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const channelBookingTools: any[] = bookingToolDefinitions.filter(
  (t: { name: string }) =>
    ["check_availability", "create_booking", "get_services", "get_staff"].includes(t.name)
);

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
      language: true,
      city: true,
      country: true,
      services: { select: { name: true, price: true, duration: true }, take: 20 },
      faqs: { select: { question: true, answer: true }, take: 20 },
      staff: { select: { name: true, role: true }, take: 10 },
      documents: { where: { parsed: true }, select: { name: true, extractedText: true }, take: 5 },
    },
  });
}

/**
 * Build system prompt for channel AI
 */
function buildChannelSystemPrompt(
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
        .map((s) => `- ${s.name}${s.price ? ` — ${s.price.toLocaleString("ru-RU")}` : ""}${s.duration ? ` (${s.duration} мин)` : ""}`)
        .join("\n")
    : "Услуги не указаны";

  const staffList = biz.staff.length > 0
    ? biz.staff.map((s) => `- ${s.name}${s.role ? ` (${s.role})` : ""}`).join("\n")
    : "";

  const faqList = biz.faqs.length > 0
    ? biz.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "";

  let prompt = `Ты — AI-помощник бизнеса «${biz.name}» в ${channelName}. Твоя задача — вежливо и точно отвечать на вопросы клиентов, помогать с записью и информацией об услугах. Общайся ${tone} тоном.`;

  if (biz.address) prompt += `\n\nАдрес: ${biz.address}`;
  if (biz.phone) prompt += `\nТелефон: ${biz.phone}`;
  if (biz.workingHours) prompt += `\nРежим работы: ${biz.workingHours}`;
  if (biz.city) prompt += `\nГород: ${biz.city}`;

  prompt += `\n\nУслуги:\n${servicesList}`;

  if (staffList) prompt += `\n\nСпециалисты:\n${staffList}`;

  if (faqList) prompt += `\n\nЧасто задаваемые вопросы:\n${faqList}`;

  // Add knowledge base documents
  const docs = biz.documents
    .filter((d) => d.extractedText)
    .map((d) => {
      const text = d.extractedText!.length > 4000 ? d.extractedText!.substring(0, 4000) + "..." : d.extractedText!;
      return `### ${d.name}:\n${text}`;
    });
  if (docs.length > 0) {
    prompt += `\n\nДокументы базы знаний:\n${docs.join("\n\n")}`;
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
  toolInput: Record<string, string>,
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

    // Call Claude with booking tools
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: channelBookingTools,
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

    // Extract final text response
    const textBlocks = response.content.filter((block) => block.type === "text");
    const replyText = textBlocks.length > 0 && textBlocks[0].type === "text"
      ? textBlocks[0].text
      : "Извините, не удалось сформировать ответ. Пожалуйста, попробуйте ещё раз.";

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
    console.error(`Channel AI error (${channel}):`, e);
    return "Извините, произошла техническая ошибка. Пожалуйста, напишите нам позже.";
  }
}
