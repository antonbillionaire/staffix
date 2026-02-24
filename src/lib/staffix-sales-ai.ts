/**
 * Staffix Sales AI — консультирует потенциальных клиентов о продукте Staffix
 * через WhatsApp и Facebook Messenger.
 * Хранит историю в модели SalesLead.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type HistoryMessage = { role: "user" | "assistant"; content: string };

const STAFFIX_SALES_SYSTEM_PROMPT = `Ты — AI-консультант платформы Staffix. Помогаешь владельцам бизнеса узнать о продукте и начать пользоваться им.

Staffix — SaaS-платформа, которая создаёт AI-сотрудника (бота) для бизнеса. Бот автоматически:
• Отвечает клиентам в Telegram 24/7
• Принимает записи (салоны, клиники, барбершопы)
• Принимает заказы (магазины, рестораны, цветочные)
• Ведёт базу клиентов и CRM
• Делает рассылки клиентам
• Отправляет напоминания о записях
• Обрабатывает оплату через Payme, Click, Kaspi

ТАРИФЫ:
• Пробный период: 14 дней БЕСПЛАТНО, 100 сообщений
• Starter — $19/мес: 1 000 сообщений/мес
• Pro — $49/мес: 5 000 сообщений/мес
• Business — $99/мес: безлимит

РЕГИСТРАЦИЯ: https://staffix.io

КОМУ ПОДХОДИТ:
Салоны красоты, барбершопы, nail-студии, массажные студии, медицинские клиники, стоматологии, рестораны, кафе, цветочные магазины, интернет-магазины, юридические услуги, фитнес, образование и любой другой бизнес с клиентами.

КАК РАБОТАЕТ:
1. Владелец регистрируется на staffix.io
2. Проходит онбординг (тип бизнеса, название, услуги)
3. Создаёт бота в Telegram через @BotFather (5 минут)
4. Вставляет токен бота в Staffix
5. AI-сотрудник готов к работе!

ТВОЯ ЗАДАЧА:
- Отвечай на вопросы о продукте честно и конкретно
- Помоги понять подходит ли Staffix для их бизнеса
- Убеди попробовать бесплатный trial
- Спроси о типе бизнеса чтобы дать релевантный пример
- Собери контакт (имя, номер телефона или email) для передачи менеджеру

СТИЛЬ:
- Дружелюбный, живой, без корпоративного языка
- Короткие понятные ответы
- Конкретные примеры для их типа бизнеса
- Не навязывай, помогай принять решение

Отвечай на языке клиента (русский, узбекский, казахский, английский).`;

/**
 * Get or create a SalesLead record for this WhatsApp/FB contact
 */
async function getOrCreateLead(
  channel: string,
  channelId: string, // waId or fbPsid
  name?: string,
  phone?: string
) {
  const channelField = channel === "whatsapp" ? "whatsappPhone" : "instagramId";

  let lead = await prisma.salesLead.findFirst({
    where: { [channelField]: channelId },
  });

  if (!lead) {
    lead = await prisma.salesLead.create({
      data: {
        channel,
        [channelField]: channelId,
        name: name || null,
        phone: phone || null,
        stage: "new",
        history: [],
      },
    });
  }

  return lead;
}

/**
 * Generate Staffix sales AI response
 */
export async function generateStaffixSalesResponse(
  channel: string,
  channelId: string,
  userMessage: string,
  clientName?: string,
  clientPhone?: string
): Promise<string> {
  try {
    const lead = await getOrCreateLead(channel, channelId, clientName, clientPhone);
    const history = (lead.history as HistoryMessage[]) || [];
    const recentHistory = history.slice(-20);

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...recentHistory,
      { role: "user", content: userMessage },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: STAFFIX_SALES_SYSTEM_PROMPT,
      messages,
    });

    const replyText =
      response.content.find((b) => b.type === "text")?.text ||
      "Привет! Я AI-консультант Staffix. Расскажите о вашем бизнесе — помогу понять как Staffix может вам помочь!";

    // Update history and lead info
    const updatedHistory = ([
      ...history,
      { role: "user" as const, content: userMessage },
      { role: "assistant" as const, content: replyText },
    ] as HistoryMessage[]).slice(-40);

    // Try to extract name/phone from the conversation if not provided
    const updateData: Record<string, unknown> = {
      history: updatedHistory,
      updatedAt: new Date(),
    };
    if (clientName && !lead.name) updateData.name = clientName;
    if (clientPhone && !lead.phone) updateData.phone = clientPhone;
    if (lead.stage === "new") updateData.stage = "interested";

    await prisma.salesLead.update({
      where: { id: lead.id },
      data: updateData,
    });

    return replyText;
  } catch (e) {
    console.error("Staffix Sales AI error:", e);
    return "Привет! Я AI-консультант Staffix. Расскажите о вашем бизнесе — помогу понять как Staffix может вам помочь! 🚀";
  }
}
