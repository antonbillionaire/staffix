/**
 * Telegram conversation persistence — получаем/создаём Conversation и сохраняем Message.
 *
 * Особенность: при включённом флаге `needsContextRefresh` (выставляется когда
 * владелец обновил базу знаний) логика разная для активного и остывшего диалога:
 *  - Активный (последнее сообщение <10 мин назад): историю НЕ режем, ставим
 *    soft warning — бот в промпте увидит предупреждение «факты могли устареть».
 *  - Остывший: режем историю в 0, чтобы бот не якорил ответы на старые цены/даты.
 *
 * Этот компромисс защищает UX (середина диалога не «забывается») при том что
 * ответы остаются актуальными после обновления базы знаний.
 */

import { prisma } from "@/lib/prisma";

const CONTEXT_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

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
          take: 20, // последние 20 для контекста
        },
      },
    });

    if (conversation) {
      let messagesAsc = conversation.messages
        .slice()
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));
      let softWarning = false;

      if (conversation.needsContextRefresh) {
        const lastMsgAt = conversation.messages[0]?.createdAt ?? null;
        const isActive =
          lastMsgAt &&
          Date.now() - lastMsgAt.getTime() < CONTEXT_REFRESH_COOLDOWN_MS;

        if (isActive) {
          softWarning = true;
          console.log(
            `[Webhook] Active conversation ${conversation.id}: keeping history, soft warning enabled`
          );
        } else {
          messagesAsc = [];
          console.log(
            `[Webhook] Cold conversation ${conversation.id}: history trimmed (knowledge base updated)`
          );
        }

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
