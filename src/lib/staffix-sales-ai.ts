/**
 * Staffix Sales AI — консультирует потенциальных клиентов о продукте Staffix
 * через WhatsApp, Instagram, Facebook Messenger и Telegram.
 * Хранит историю в модели SalesLead.
 * Поддерживает tools: schedule_demo, notify_owner, update_lead_stage.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getSalesSystemPrompt } from "@/lib/sales-bot/system-prompt";
import { notifyAdmin } from "@/lib/admin-notify";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type HistoryMessage = { role: "user" | "assistant"; content: string };

// ========================================
// TOOL DEFINITIONS
// ========================================

const salesBotTools: Anthropic.Tool[] = [
  {
    name: "schedule_demo",
    description:
      "Записать лида на демо-встречу с основателем Staffix. Используй когда лид согласился на встречу и предоставил контактные данные.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_name: {
          type: "string",
          description: "Имя контактного лица",
        },
        contact_phone: {
          type: "string",
          description: "Телефон или WhatsApp для связи",
        },
        contact_telegram: {
          type: "string",
          description: "Telegram username или ссылка (если есть)",
        },
        business_name: {
          type: "string",
          description: "Название бизнеса",
        },
        business_type: {
          type: "string",
          description: "Тип бизнеса: salon, barbershop, dental, clinic, fitness, spa, language_school, other",
        },
        business_address: {
          type: "string",
          description: "Адрес бизнеса (куда приехать)",
        },
        preferred_date: {
          type: "string",
          description: "Желаемая дата и время в формате YYYY-MM-DD HH:mm",
        },
        notes: {
          type: "string",
          description: "Дополнительные заметки о лиде (интересующие функции, боли, размер бизнеса)",
        },
      },
      required: ["contact_name", "preferred_date"],
    },
  },
  {
    name: "notify_owner",
    description:
      "Отправить уведомление владельцу Staffix (Антону) через Telegram. Используй когда: лид стал горячим, просит связаться с человеком, записался на демо, или произошло что-то важное.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "Текст уведомления для Антона",
        },
        priority: {
          type: "string",
          enum: ["high", "normal"],
          description: "high = горячий лид или срочное, normal = информационное",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "update_lead_stage",
    description:
      "Обновить статус лида в воронке. Используй когда статус лида изменился.",
    input_schema: {
      type: "object" as const,
      properties: {
        stage: {
          type: "string",
          enum: ["interested", "warm", "hot", "demo_requested", "trial_started", "converted", "lost"],
          description: "Новый статус лида",
        },
        reason: {
          type: "string",
          description: "Причина изменения статуса",
        },
      },
      required: ["stage"],
    },
  },
];

// ========================================
// TOOL EXECUTION
// ========================================

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  leadId: string,
  channel: string,
  channelId: string
): Promise<string> {
  switch (toolName) {
    case "schedule_demo": {
      const scheduledAt = new Date(toolInput.preferred_date as string);
      if (isNaN(scheduledAt.getTime())) {
        return JSON.stringify({ success: false, error: "Invalid date format. Use YYYY-MM-DD HH:mm" });
      }

      const booking = await prisma.demoBooking.create({
        data: {
          salesLeadId: leadId,
          contactName: (toolInput.contact_name as string) || "Unknown",
          contactPhone: (toolInput.contact_phone as string) || null,
          contactTelegram: (toolInput.contact_telegram as string) || null,
          contactWhatsapp: (toolInput.contact_phone as string) || null,
          businessName: (toolInput.business_name as string) || null,
          businessType: (toolInput.business_type as string) || null,
          businessAddress: (toolInput.business_address as string) || null,
          scheduledAt,
          notes: (toolInput.notes as string) || null,
        },
      });

      // Update lead stage
      await prisma.salesLead.update({
        where: { id: leadId },
        data: { stage: "demo_requested" },
      });

      // Notify Anton
      const dateStr = scheduledAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
      const timeStr = scheduledAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      const emoji = (toolInput.priority === "high") ? "🔥" : "📅";

      await notifyAdmin(
        `${emoji} <b>НОВАЯ ЗАПИСЬ НА ДЕМО</b>\n\n` +
        `👤 ${toolInput.contact_name}\n` +
        `📞 ${toolInput.contact_phone || "не указан"}\n` +
        `💬 TG: ${toolInput.contact_telegram || "нет"}\n` +
        `🏢 ${toolInput.business_name || "не указано"} (${toolInput.business_type || "?"})\n` +
        `📍 ${toolInput.business_address || "адрес не указан"}\n` +
        `📅 ${dateStr}, ${timeStr}\n` +
        `📝 ${toolInput.notes || "—"}\n` +
        `\n🔗 Канал: ${channel} | ID: ${channelId}`
      );

      return JSON.stringify({
        success: true,
        booking_id: booking.id,
        scheduled_at: scheduledAt.toISOString(),
        message: `Демо записано на ${dateStr}, ${timeStr}. Антон уведомлён.`,
      });
    }

    case "notify_owner": {
      const priority = toolInput.priority === "high" ? "🔥" : "ℹ️";
      await notifyAdmin(
        `${priority} <b>Sales Bot</b>\n\n` +
        `${toolInput.message}\n` +
        `\n🔗 Канал: ${channel} | Lead ID: ${leadId}`
      );
      return JSON.stringify({ success: true, message: "Антон уведомлён" });
    }

    case "update_lead_stage": {
      const newStage = toolInput.stage as string;
      await prisma.salesLead.update({
        where: { id: leadId },
        data: {
          stage: newStage,
          notes: toolInput.reason ? `[${new Date().toISOString().slice(0, 10)}] ${toolInput.reason}` : undefined,
        },
      });

      // Auto-notify for hot leads
      if (newStage === "hot") {
        await notifyAdmin(
          `🔥 <b>HOT LEAD</b>\n\n` +
          `Канал: ${channel} | Lead ID: ${leadId}\n` +
          `Причина: ${toolInput.reason || "квалифицирован как горячий"}`
        );
      }

      return JSON.stringify({ success: true, stage: newStage });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ========================================
// LEAD MANAGEMENT
// ========================================

async function getOrCreateLead(
  channel: string,
  channelId: string,
  name?: string,
  phone?: string
) {
  // Telegram uses BigInt telegramChatId
  if (channel === "telegram") {
    let lead = await prisma.salesLead.findUnique({
      where: { telegramChatId: BigInt(channelId) },
    });
    if (!lead) {
      lead = await prisma.salesLead.create({
        data: {
          channel: "telegram",
          telegramChatId: BigInt(channelId),
          name: name || null,
          phone: phone || null,
          stage: "new",
          history: [],
        },
      });
    }
    return lead;
  }

  const channelField =
    channel === "whatsapp" ? "whatsappPhone" :
    channel === "facebook" ? "fbPsid" :
    channel === "instagram" || channel === "instagram_comment" ? "instagramId" :
    null;

  let lead = channelField
    ? await prisma.salesLead.findFirst({ where: { [channelField]: channelId } })
    : null;

  if (!lead) {
    lead = await prisma.salesLead.create({
      data: {
        channel: channel.replace("_comment", ""),
        ...(channelField ? { [channelField]: channelId } : {}),
        name: name || null,
        phone: phone || null,
        stage: "new",
        history: [],
      },
    });
  }

  return lead;
}

// ========================================
// MAIN RESPONSE GENERATOR
// ========================================

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

    const messages: Anthropic.MessageParam[] = [
      ...recentHistory,
      { role: "user", content: userMessage },
    ];

    const systemPrompt = getSalesSystemPrompt() +
      `\n\nКанал: ${channel}. ID собеседника: ${channelId}` +
      `\nТекущий статус лида: ${lead.stage}` +
      (lead.name ? `\nИмя лида: ${lead.name}` : "") +
      (lead.businessName ? `\nБизнес: ${lead.businessName}` : "") +
      (lead.businessType ? `\nТип: ${lead.businessType}` : "");

    // Call Claude with tools
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: salesBotTools,
    });

    // Process tool calls in a loop
    const allMessages: Anthropic.MessageParam[] = [...messages];
    let iterations = 0;

    while (response.stop_reason === "tool_use" && iterations < 5) {
      iterations++;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ContentBlock & { type: "tool_use" } => b.type === "tool_use"
      );

      // Add assistant message with tool use
      allMessages.push({ role: "assistant", content: response.content });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          lead.id,
          channel,
          channelId
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add tool results and get next response
      allMessages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        messages: allMessages,
        tools: salesBotTools,
      });
    }

    // Extract final text response
    const replyText =
      response.content.find((b) => b.type === "text")?.text ||
      "Привет! Я AI-консультант Staffix. Расскажите о вашем бизнесе — помогу понять как Staffix может вам помочь!";

    // Update history and lead info
    const updatedHistory = ([
      ...history,
      { role: "user" as const, content: userMessage },
      { role: "assistant" as const, content: replyText },
    ] as HistoryMessage[]).slice(-40);

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
    return "Привет! Я AI-консультант Staffix. Расскажите о вашем бизнесе — помогу понять как Staffix может вам помочь!";
  }
}
