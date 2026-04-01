/**
 * Channel Memory System for Staffix
 * AI Learning: память для клиентов из каналов (WhatsApp, Instagram, Facebook)
 * Зеркало ai-memory.ts, но работает с ChannelClient и ChannelConversation
 */

import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

// ========================================
// LAZY ANTHROPIC CLIENT
// ========================================

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

// ========================================
// ТИПЫ
// ========================================

interface ChannelClientContext {
  channelClientId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  aiSummary: string | null;
  preferences: Record<string, unknown> | null;
  importantNotes: string | null;
  communicationStyle: string | null;
  totalMessages: number;
  totalVisits: number;
  lastVisitDate: Date | null;
  tags: string[];
  recentLeads: Array<{
    createdAt: Date;
    status: string;
    source: string;
    clientName: string | null;
  }>;
  conversationSummaries: string[];
}

// ========================================
// 1. ЗАГРУЗКА КОНТЕКСТА КЛИЕНТА КАНАЛА
// ========================================

/**
 * Загружает полный контекст клиента канала для AI
 */
export async function buildChannelClientContext(
  businessId: string,
  channel: string,
  clientId: string
): Promise<ChannelClientContext | null> {
  try {
    // Находим клиента по каналу
    const channelClient = await findChannelClient(businessId, channel, clientId);
    if (!channelClient) return null;

    // Загружаем последние лиды (записи/заявки) клиента
    const recentLeads = await prisma.lead.findMany({
      where: {
        businessId,
        clientId: channelClient.id,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        createdAt: true,
        status: true,
        source: true,
        clientName: true,
      },
    });

    // Загружаем последние разговоры с саммари
    const conversations = await prisma.channelConversation.findMany({
      where: {
        businessId,
        channel,
        clientId,
        summary: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { summary: true },
    });

    return {
      channelClientId: channelClient.id,
      name: channelClient.name,
      phone: channelClient.phone,
      email: channelClient.email,
      aiSummary: channelClient.aiSummary,
      preferences: channelClient.preferences as Record<string, unknown> | null,
      importantNotes: channelClient.importantNotes,
      communicationStyle: channelClient.communicationStyle,
      totalMessages: channelClient.totalMessages,
      totalVisits: channelClient.totalVisits,
      lastVisitDate: channelClient.lastVisitDate,
      tags: channelClient.tags,
      recentLeads: recentLeads.map((l) => ({
        createdAt: l.createdAt,
        status: l.status,
        source: l.source,
        clientName: l.clientName,
      })),
      conversationSummaries: conversations
        .map((c) => c.summary)
        .filter((s): s is string => s !== null),
    };
  } catch (error) {
    console.error("[channel-memory] Error building channel client context:", error);
    return null;
  }
}

// ========================================
// 2. ФОРМИРОВАНИЕ БЛОКА ДЛЯ СИСТЕМНОГО ПРОМПТА
// ========================================

/**
 * Формирует текстовый блок с информацией о клиенте для system prompt
 */
export function buildClientContextBlock(context: ChannelClientContext): string {
  let block = "## ИНФОРМАЦИЯ О КЛИЕНТЕ";

  if (context.name) {
    block += `\n- Имя: ${context.name}`;
  }

  block += `\n- Сообщений: ${context.totalMessages}`;

  if (context.totalVisits > 0) {
    block += `\n- Визиты: ${context.totalVisits}`;
  }

  if (context.lastVisitDate) {
    block += `\n- Последний визит: ${new Date(context.lastVisitDate).toLocaleDateString("ru-RU")}`;
  }

  if (context.aiSummary) {
    block += `\n- О клиенте: ${context.aiSummary}`;
  }

  if (context.importantNotes) {
    block += `\n- ВАЖНО: ${context.importantNotes}`;
  }

  if (context.preferences) {
    const prefs = context.preferences;
    if (prefs.preferredServices) {
      block += `\n- Предпочитает услуги: ${(prefs.preferredServices as string[]).join(", ")}`;
    }
    if (prefs.preferredTime) {
      block += `\n- Предпочитает время: ${prefs.preferredTime}`;
    }
    if (prefs.allergies) {
      block += `\n- Аллергии: ${(prefs.allergies as string[]).join(", ")}`;
    }
  }

  if (context.communicationStyle) {
    const styleLabels: Record<string, string> = {
      formal: "формальный",
      friendly: "дружелюбный",
      casual: "неформальный",
    };
    block += `\n- Стиль общения: ${styleLabels[context.communicationStyle] || context.communicationStyle}`;
  }

  if (context.recentLeads.length > 0) {
    block += `\n- Последние заявки:`;
    for (const lead of context.recentLeads.slice(0, 3)) {
      const date = new Date(lead.createdAt).toLocaleDateString("ru-RU");
      block += `\n  • ${date}: ${lead.clientName || "заявка"} (${lead.status})`;
    }
  }

  if (context.conversationSummaries.length > 0) {
    block += `\n- Из прошлых разговоров:`;
    for (const summary of context.conversationSummaries) {
      block += `\n  • ${summary}`;
    }
  }

  if (context.tags.length > 0) {
    block += `\n- Теги: ${context.tags.join(", ")}`;
  }

  return block;
}

// ========================================
// 3. ЗАГРУЗКА АКТИВНЫХ КОРРЕКЦИЙ
// ========================================

/**
 * Загружает активные коррекции бота для бизнеса
 */
export async function loadActiveCorrections(businessId: string): Promise<string> {
  try {
    const corrections = await prisma.botCorrection.findMany({
      where: {
        businessId,
        isActive: true,
      },
      orderBy: { usageCount: "desc" },
      take: 30,
    });

    if (corrections.length === 0) return "";

    let result = "## ПРАВИЛА (исправления владельца)";
    for (const c of corrections) {
      result += `\n- Когда спрашивают: "${c.originalQuestion}" → Отвечай: "${c.correctAnswer}"`;
    }

    return result;
  } catch (error) {
    console.error("[channel-memory] Error loading corrections:", error);
    return "";
  }
}

// ========================================
// 4. ГЕНЕРАЦИЯ САММАРИ РАЗГОВОРА
// ========================================

/**
 * Генерирует саммари разговора канала с помощью Claude Haiku
 */
export async function generateChannelConversationSummary(
  conversationId: string
): Promise<string | null> {
  try {
    const conversation = await prisma.channelConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = conversation.history as any[];
    if (!history || history.length < 3) return null;

    const messagesText = history
      .slice(-20) // Берём последние 20 сообщений
      .map((m: { role: string; content: string }) =>
        `${m.role === "user" ? "Клиент" : "AI"}: ${m.content}`
      )
      .join("\n");

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Проанализируй разговор и верни JSON (без markdown):
{
  "summary": "краткое содержание в 1-2 предложениях",
  "topic": "одно из: booking, inquiry, complaint, feedback, order, other",
  "outcome": "одно из: booked, answered, escalated, unresolved, ordered"
}

Разговор:
${messagesText}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : null;
    if (!text) return null;

    let parsed: { summary: string; topic: string; outcome: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      // Если не удалось распарсить JSON, используем как plain text summary
      parsed = { summary: text.slice(0, 500), topic: "other", outcome: "answered" };
    }

    // Обновляем запись разговора
    await prisma.channelConversation.update({
      where: { id: conversationId },
      data: {
        summary: parsed.summary,
        topic: parsed.topic,
        outcome: parsed.outcome,
        needsSummary: false,
      },
    });

    return parsed.summary;
  } catch (error) {
    console.error("[channel-memory] Error generating conversation summary:", error);
    return null;
  }
}

// ========================================
// 5. ОБНОВЛЕНИЕ ПРОФИЛЯ КЛИЕНТА
// ========================================

/**
 * Обновляет AI-саммари клиента канала на основе всех разговоров
 */
export async function updateChannelClientSummary(
  channelClientId: string
): Promise<string | null> {
  try {
    const client = await prisma.channelClient.findUnique({
      where: { id: channelClientId },
    });

    if (!client) return null;

    // Получаем последние разговоры с саммари
    // Ищем по всем каналам через которые клиент общался
    const identifiers: Array<{ channel: string; clientId: string }> = [];
    if (client.whatsappPhone) identifiers.push({ channel: "whatsapp", clientId: client.whatsappPhone });
    if (client.instagramId) identifiers.push({ channel: "instagram", clientId: client.instagramId });
    if (client.telegramId) identifiers.push({ channel: "telegram", clientId: client.telegramId });

    if (identifiers.length === 0) return null;

    const conversations = await prisma.channelConversation.findMany({
      where: {
        businessId: client.businessId,
        summary: { not: null },
        OR: identifiers.map((id) => ({
          channel: id.channel,
          clientId: id.clientId,
        })),
      },
      select: { summary: true, topic: true, outcome: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    if (conversations.length === 0) return null;

    const summariesText = conversations
      .map((c) => {
        let line = `- ${c.summary}`;
        if (c.topic) line += ` [${c.topic}]`;
        if (c.outcome) line += ` → ${c.outcome}`;
        return line;
      })
      .join("\n");

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `На основе истории разговоров с клиентом, верни JSON (без markdown):
{
  "aiSummary": "краткий профиль клиента в 1-2 предложениях",
  "preferences": ["предпочтение1", "предпочтение2"],
  "importantNotes": "важные заметки или null",
  "communicationStyle": "formal или friendly или casual"
}

Имя клиента: ${client.name || "неизвестно"}
Сообщений всего: ${client.totalMessages}

Разговоры:
${summariesText}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : null;
    if (!text) return null;

    let parsed: {
      aiSummary: string;
      preferences: string[];
      importantNotes: string | null;
      communicationStyle: string;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      // Fallback: используем как plain text
      parsed = {
        aiSummary: text.slice(0, 500),
        preferences: [],
        importantNotes: null,
        communicationStyle: "friendly",
      };
    }

    // Merge preferences с существующими
    const existingPrefs = (client.preferences as Record<string, unknown>) || {};
    const updatedPrefs = {
      ...existingPrefs,
      preferredServices: parsed.preferences,
    };

    await prisma.channelClient.update({
      where: { id: channelClientId },
      data: {
        aiSummary: parsed.aiSummary,
        preferences: updatedPrefs,
        importantNotes: parsed.importantNotes || client.importantNotes,
        communicationStyle: parsed.communicationStyle,
        summaryUpdatedAt: new Date(),
      },
    });

    return parsed.aiSummary;
  } catch (error) {
    console.error("[channel-memory] Error updating channel client summary:", error);
    return null;
  }
}

// ========================================
// 6. СОХРАНЕНИЕ ЗАМЕТКИ О КЛИЕНТЕ
// ========================================

/**
 * Сохраняет заметку о клиенте (предпочтение, аллергия, важное, стиль)
 */
export async function saveClientNote(
  businessId: string,
  channel: string,
  clientId: string,
  noteType: "preference" | "allergy" | "important" | "style",
  content: string
): Promise<void> {
  try {
    // Находим или создаём клиента
    const channelClient = await findOrCreateChannelClient(businessId, channel, clientId);

    const existingPrefs = (channelClient.preferences as Record<string, unknown>) || {};

    switch (noteType) {
      case "preference": {
        const services = (existingPrefs.preferredServices as string[]) || [];
        if (!services.includes(content)) {
          services.push(content);
        }
        await prisma.channelClient.update({
          where: { id: channelClient.id },
          data: {
            preferences: { ...existingPrefs, preferredServices: services },
          },
        });
        break;
      }
      case "allergy": {
        const allergies = (existingPrefs.allergies as string[]) || [];
        if (!allergies.includes(content)) {
          allergies.push(content);
        }
        await prisma.channelClient.update({
          where: { id: channelClient.id },
          data: {
            preferences: { ...existingPrefs, allergies },
          },
        });
        break;
      }
      case "important": {
        const existing = channelClient.importantNotes || "";
        const separator = existing ? "; " : "";
        await prisma.channelClient.update({
          where: { id: channelClient.id },
          data: {
            importantNotes: existing + separator + content,
          },
        });
        break;
      }
      case "style": {
        await prisma.channelClient.update({
          where: { id: channelClient.id },
          data: {
            communicationStyle: content,
          },
        });
        break;
      }
    }
  } catch (error) {
    console.error("[channel-memory] Error saving client note:", error);
  }
}

// ========================================
// 7. ПОМЕТКА РАЗГОВОРА ДЛЯ СУММАРИЗАЦИИ
// ========================================

/**
 * Помечает разговор для суммаризации каждые 10 сообщений
 */
export async function markConversationForSummary(
  conversationId: string,
  messageCount: number
): Promise<boolean> {
  if (messageCount % 10 !== 0) return false;

  try {
    await prisma.channelConversation.update({
      where: { id: conversationId },
      data: { needsSummary: true },
    });
    return true;
  } catch (error) {
    console.error("[channel-memory] Error marking conversation for summary:", error);
    return false;
  }
}

// ========================================
// HELPERS
// ========================================

/**
 * Находит ChannelClient по каналу и идентификатору
 */
async function findChannelClient(
  businessId: string,
  channel: string,
  clientId: string
) {
  const where: Record<string, unknown> = { businessId };

  switch (channel) {
    case "whatsapp":
      where.whatsappPhone = clientId;
      break;
    case "instagram":
      where.instagramId = clientId;
      break;
    case "telegram":
      where.telegramId = clientId;
      break;
    case "facebook":
    case "messenger":
      // Facebook uses instagramId field or we search by any matching field
      where.instagramId = clientId;
      break;
    default:
      return null;
  }

  return prisma.channelClient.findFirst({ where });
}

/**
 * Находит или создаёт ChannelClient
 */
async function findOrCreateChannelClient(
  businessId: string,
  channel: string,
  clientId: string
) {
  const existing = await findChannelClient(businessId, channel, clientId);
  if (existing) return existing;

  const data: Record<string, unknown> = { businessId };

  switch (channel) {
    case "whatsapp":
      data.whatsappPhone = clientId;
      break;
    case "instagram":
      data.instagramId = clientId;
      break;
    case "telegram":
      data.telegramId = clientId;
      break;
    case "facebook":
    case "messenger":
      data.instagramId = clientId;
      break;
  }

  return prisma.channelClient.create({ data: data as Parameters<typeof prisma.channelClient.create>[0]["data"] });
}
