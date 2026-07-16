import { prisma } from "./prisma";

/**
 * Create a manager task triggered by AI escalation (notify_manager tool).
 *
 * The AI calls notify_manager when a conversation needs a human — those used
 * to disappear into a Telegram notification only. Now they also land as a
 * persistent task in the dashboard so nothing falls through the cracks.
 *
 * Best-effort: errors are logged, never thrown — task creation must not
 * break the AI tool path.
 */
export async function createEscalationTask(params: {
  businessId: string;
  clientTelegramId?: bigint;
  // Канал и ID клиента в канале — нужны чтобы из задачи сделать прямую ссылку
  // на переписку в /dashboard/messages. Для TG передаём "telegram" + str(chatId).
  // Для WA/IG/FB — соответствующий channel + clientId из ChannelClient.
  clientChannel?: string;
  clientChannelId?: string;
  clientName?: string;
  reason: string;
  urgency?: string | null;
}): Promise<void> {
  try {
    let clientId: string | null = null;
    let resolvedClientName = params.clientName?.trim() || "клиент";

    // Для TG подтягиваем ещё @username — чтобы в заголовке задачи было
    // видно куда именно писать («связаться с @ann_matveeva»), а не просто
    // «связаться с клиентом» без опознавательных знаков.
    let telegramUsername: string | null = null;
    if (params.clientTelegramId) {
      const client = await prisma.client.findUnique({
        where: {
          businessId_telegramId: {
            businessId: params.businessId,
            telegramId: params.clientTelegramId,
          },
        },
        select: { id: true, name: true, telegramUsername: true, assignedStaffId: true },
      });
      if (client) {
        clientId = client.id;
        if (client.name) resolvedClientName = client.name;
        if (client.telegramUsername) telegramUsername = client.telegramUsername;
      }
    }

    // Fall back to assigned seller if client has one — keeps the lead with
    // the rep who already owns the relationship.
    let assignedStaffId: string | null = null;
    if (clientId) {
      const c = await prisma.client.findUnique({
        where: { id: clientId },
        select: { assignedStaffId: true },
      });
      assignedStaffId = c?.assignedStaffId ?? null;
    }

    const isUrgent = params.urgency === "urgent";
    const dueAt = new Date();
    // Urgent → due in 30 min, normal → end of business day (or +4h, whichever sooner).
    if (isUrgent) {
      dueAt.setMinutes(dueAt.getMinutes() + 30);
    } else {
      dueAt.setHours(dueAt.getHours() + 4);
    }

    // Заголовок с меткой канала — сразу видно откуда клиент.
    // Для TG приклеиваем @username в скобках если он известен.
    const channelLabel: Record<string, string> = {
      telegram: "TG",
      whatsapp: "WA",
      instagram: "IG",
      facebook: "FB",
    };
    const chLabel = params.clientChannel ? channelLabel[params.clientChannel] : null;
    const nameWithHandle = telegramUsername
      ? `${resolvedClientName} (@${telegramUsername})`
      : resolvedClientName;
    const title = chLabel
      ? `Связаться с клиентом (${chLabel}): ${nameWithHandle}`
      : `Связаться с клиентом: ${nameWithHandle}`;

    await prisma.task.create({
      data: {
        businessId: params.businessId,
        clientId,
        assignedStaffId,
        clientChannel: params.clientChannel || null,
        clientChannelId: params.clientChannelId || null,
        title,
        description: params.reason.slice(0, 2000), // подняли лимит с 1000 — контекст стал богаче
        priority: isUrgent ? "high" : "normal",
        dueAt,
        createdBy: "ai",
      },
    });
  } catch (error) {
    console.warn("createEscalationTask failed:", error);
  }
}
