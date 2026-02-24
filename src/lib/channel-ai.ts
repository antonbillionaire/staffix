/**
 * AI response engine for WhatsApp and Facebook Messenger channels.
 * Reuses business context logic from Telegram webhook but stores
 * conversation history in ChannelConversation model (JSON).
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type HistoryMessage = { role: "user" | "assistant"; content: string };

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
  const channelName = channel === "whatsapp" ? "WhatsApp" : "Facebook Messenger";
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

  if (biz.welcomeMessage) {
    prompt += `\n\nПриветственное сообщение для новых клиентов:\n${biz.welcomeMessage}`;
  }

  if (biz.aiRules) {
    prompt += `\n\nВажные правила:\n${biz.aiRules}`;
  }

  prompt += `\n\nЕсли клиент хочет записаться — уточни имя, желаемую услугу, специалиста (если важно) и удобное время. Затем сообщи что передашь информацию и с ними свяжутся для подтверждения (или скажи позвонить по телефону если нет онлайн-записи).

Отвечай на языке клиента (русский, узбекский, казахский, английский).`;

  const today = new Date().toLocaleDateString("ru-RU", {
    weekday: "long", day: "numeric", month: "long",
  });
  prompt += `\n\nСегодня: ${today}.`;

  return prompt;
}

/**
 * Generate AI response for a WhatsApp/FB message
 * Returns the assistant reply text
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
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...recentHistory,
      { role: "user", content: userMessage },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const replyText =
      response.content.find((b) => b.type === "text")?.text ||
      "Извините, не удалось сформировать ответ. Пожалуйста, попробуйте ещё раз.";

    // Save messages to history
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
