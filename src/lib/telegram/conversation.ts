/**
 * Telegram conversation persistence — получаем/создаём Conversation и сохраняем Message.
 *
 * Особенность: при включённом флаге `needsContextRefresh` (выставляется когда
 * владелец обновил базу знаний в дашборде) — жёстко режем историю до реплик
 * клиента только, выбрасывая ВСЕ ассистент-ответы. Это защита от того, что
 * бот якорит новый ответ на свои же прошлые цифры/цены/даты, которые теперь
 * устарели. Плюс в системный промпт добавляется явный warning.
 *
 * Раньше (до июля 2026) был 10-минутный cooldown с soft warning — слабо,
 * модель всё равно предпочитала историю новому промпту.
 */

import { prisma } from "@/lib/prisma";

export async function getOrCreateConversation(
  businessId: string,
  telegramId: bigint,
  clientName?: string
): Promise<{
  id: string;
  messages: Array<{ role: string; content: string }>;
  contextRefreshSoftWarning: boolean;
}> {
  try {
    // Шаг 4 плана оптимизации себестоимости (21 июля 2026):
    // если у conversation уже есть summary (генерируется cron-summarize
    // каждые 10 сообщений) — берём только 5 последних сообщений вместо 20.
    // Summary сам уже уходит в system prompt через ai-memory. Экономия:
    // ~10-15k tokens на длинных беседах, качество ответа не страдает
    // (summary концентрированнее чем 15 старых сырых сообщений).
    let conversation = await prisma.conversation.findUnique({
      where: {
        businessId_clientTelegramId: {
          businessId,
          clientTelegramId: telegramId,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 20, // берём с запасом, ниже режем до 5 если есть summary
        },
      },
    });

    if (conversation) {
      // Если есть summary И диалог длинный (>=10 msg) — грузим 5 последних.
      // Если summary нет или диалог короткий — 20 как раньше.
      const hasFreshSummary = !!conversation.summary && conversation.messageCount >= 10;
      const keepLast = hasFreshSummary ? 5 : 20;

      let messagesAsc = conversation.messages
        .slice()
        .reverse()
        .slice(-keepLast)
        .map((m) => ({ role: m.role, content: m.content }));
      let softWarning = false;

      if (hasFreshSummary) {
        console.log(
          `[Webhook] Conv ${conversation.id}: has summary + ${conversation.messageCount} msgs → sending only last ${messagesAsc.length} messages (Step 4 optimization)`
        );
      }

      if (conversation.needsContextRefresh) {
        // Жёсткая стратегия (Right Flight case, июль 2026): при обновлении
        // базы знаний ВСЕГДА выкидываем свои прошлые ассистент-ответы —
        // они содержат старые цифры, старые цены, старые даты. Оставляем
        // ТОЛЬКО реплики клиента как контекст «о чём был разговор».
        // Раньше был 10-минутный cooldown с soft warning — слабо, модель
        // всё равно якорилась на своих старых ответах в истории.
        messagesAsc = messagesAsc.filter((m) => m.role === "user").slice(-10);
        softWarning = true;
        console.log(
          `[Webhook] Conv ${conversation.id}: knowledge refreshed — kept ${messagesAsc.length} user turns, dropped assistant history`
        );

        await prisma.conversation
          .update({
            where: { id: conversation.id },
            data: { needsContextRefresh: false },
          })
          .catch((e) =>
            console.error("[Webhook] reset needsContextRefresh failed:", e)
          );
      }

      return {
        id: conversation.id,
        messages: messagesAsc,
        contextRefreshSoftWarning: softWarning,
      };
    }

    conversation = await prisma.conversation.create({
      data: {
        businessId,
        clientTelegramId: telegramId,
        clientName,
        messageCount: 0,
      },
      include: { messages: true },
    });

    // Increment totalConversations only when a NEW conversation is created
    prisma.business
      .update({
        where: { id: businessId },
        data: { totalConversations: { increment: 1 } },
      })
      .catch((e) => console.error("[Webhook] totalConversations increment error:", e));

    return { id: conversation.id, messages: [], contextRefreshSoftWarning: false };
  } catch (error) {
    console.error("Error getting conversation:", error);
    throw error;
  }
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  try {
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
      },
    });
  } catch (error) {
    console.error("Error saving message:", error);
  }
}
