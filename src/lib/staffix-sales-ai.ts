/**
 * Staffix Sales AI — консультирует потенциальных клиентов о продукте Staffix
 * через WhatsApp и Facebook Messenger.
 * Хранит историю в модели SalesLead.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getSalesSystemPrompt } from "@/lib/sales-bot/system-prompt";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type HistoryMessage = { role: "user" | "assistant"; content: string };

/**
 * Get or create a SalesLead record for this WhatsApp/FB contact
 */
async function getOrCreateLead(
  channel: string,
  channelId: string, // waId or fbPsid
  name?: string,
  phone?: string
) {
  const channelField =
    channel === "whatsapp" ? "whatsappPhone" :
    channel === "facebook" ? "fbPsid" : "instagramId";

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
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: getSalesSystemPrompt() + `\n\nКанал: ${channel}. ID собеседника: ${channelId}`,
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
