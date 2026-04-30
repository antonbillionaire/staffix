import { prisma } from "@/lib/prisma";

/**
 * Помечает все активные диалоги бизнеса как требующие обновления контекста.
 * Вызывается после изменений в базе знаний (FAQ, документы, услуги, товары),
 * чтобы при следующем сообщении бот обрезал старую историю и опирался
 * на свежие данные из системного промпта, а не на свои прошлые ответы.
 *
 * Безопасно — никогда не бросает наружу: ошибка БД не должна ломать сам апдейт
 * базы знаний. Если флаг не выставился — в худшем случае бот ответит из истории,
 * это ровно текущее (рабочее) поведение.
 */
export async function markBusinessConversationsForRefresh(
  businessId: string
): Promise<void> {
  if (!businessId) return;

  try {
    await Promise.all([
      prisma.conversation.updateMany({
        where: { businessId, needsContextRefresh: false },
        data: { needsContextRefresh: true },
      }),
      prisma.channelConversation.updateMany({
        where: { businessId, needsContextRefresh: false },
        data: { needsContextRefresh: true },
      }),
    ]);
  } catch (error) {
    console.error("[knowledge-refresh] failed to mark conversations:", error);
  }
}
