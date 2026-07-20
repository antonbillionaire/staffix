/**
 * Unified client identity resolution (Sprint 3, июль 2026).
 *
 * До этого каждый канал имел свою логику: Telegram использовал
 * Client(businessId, telegramId), а WA/IG/FB — параллельную таблицу
 * ChannelClient с channel-specific ID. Из-за этого клиент из WhatsApp
 * не появлялся в /dashboard/customers, deal-pipeline его игнорировал,
 * лояльность не работала, и владелец не мог назначить менеджера.
 *
 * Этот модуль — точка слияния. Всё что нужно webhook'у любого канала:
 *
 *     const client = await findOrCreateClientForChannel({
 *       businessId,
 *       channel: "whatsapp",
 *       channelId: msg.waId,
 *       name: msg.name,
 *       phone: msg.phone,
 *     });
 *
 * Возвращает Client-запись (создаёт новую если не нашлась). Все
 * последующие AI-tools, CRM-события и напоминания работают с этим
 * единым Client. ChannelClient пока живёт параллельно — его почистит
 * backfill-скрипт после того как все webhook'и переключатся сюда.
 */

import { prisma } from "@/lib/prisma";

export type ClientChannel = "telegram" | "whatsapp" | "instagram" | "facebook";

interface FindOrCreateArgs {
  businessId: string;
  channel: ClientChannel;
  /** Channel-specific ID. Для TG — telegramId as string (конвертируем в BigInt). Для WA — waId. Для IG — igScopedUserId. Для FB — psid. */
  channelId: string;
  /** Имя клиента если пришло от канала. */
  name?: string | null;
  /** Телефон если пришёл (для WA — как правило равен channelId с "+"). */
  phone?: string | null;
  /** Telegram @username, только для channel=telegram. */
  telegramUsername?: string | null;
}

/**
 * Ищет существующего Client по channel-specific ID. Если не нашёл —
 * пытается связать по phone (тот же владелец давно ведёт клиента вручную).
 * Если и по phone нет — создаёт новую запись.
 *
 * Возвращает Client с полями достаточными для последующей работы AI/CRM.
 */
export async function findOrCreateClientForChannel(args: FindOrCreateArgs) {
  const { businessId, channel, channelId, name, phone, telegramUsername } = args;

  // 1. Прямой lookup по channel-specific id.
  const directWhere = channelWhere(businessId, channel, channelId);
  const direct = await prisma.client.findFirst({ where: directWhere });
  if (direct) {
    // Обновляем «дрейфующие» поля если получили новую версию имени/телефона/username.
    // Не перезаписываем непустое имя пустым — просто дозаполняем.
    const updates: Record<string, unknown> = {};
    if (name && !direct.name) updates.name = name;
    if (phone && !direct.phone) updates.phone = phone;
    if (channel === "telegram" && telegramUsername && direct.telegramUsername !== telegramUsername) {
      updates.telegramUsername = telegramUsername;
    }
    if (Object.keys(updates).length > 0) {
      return prisma.client.update({ where: { id: direct.id }, data: updates });
    }
    return direct;
  }

  // 2. Fallback: клиент того же бизнеса с таким же телефоном — привязываем этот
  //    канал к существующей карточке (владелец давно ведёт клиента через CRM,
  //    сейчас он написал в WhatsApp; не создаём вторую карточку).
  if (phone) {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length >= 9) {
      const byPhone = await prisma.client.findFirst({
        where: { businessId, phone: { contains: normalized.slice(-9) } },
      });
      if (byPhone) {
        return prisma.client.update({
          where: { id: byPhone.id },
          data: channelPatch(channel, channelId, name ?? null),
        });
      }
    }
  }

  // 3. Нет ни по каналу, ни по телефону — создаём.
  return prisma.client.create({
    data: {
      businessId,
      name: name || null,
      phone: phone || null,
      ...channelPatch(channel, channelId, null),
      ...(channel === "telegram" && telegramUsername ? { telegramUsername } : {}),
    },
  });
}

/** Prisma-where по channel-specific id для findFirst. */
function channelWhere(businessId: string, channel: ClientChannel, channelId: string) {
  switch (channel) {
    case "telegram":
      return { businessId, telegramId: safeBigInt(channelId) };
    case "whatsapp":
      return { businessId, whatsappId: channelId };
    case "instagram":
      return { businessId, instagramId: channelId };
    case "facebook":
      return { businessId, fbPsid: channelId };
  }
}

/** data-объект для create/update: заполняет канальный ID и опционально имя (только если было пусто). */
function channelPatch(channel: ClientChannel, channelId: string, name: string | null) {
  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  switch (channel) {
    case "telegram":
      patch.telegramId = safeBigInt(channelId);
      break;
    case "whatsapp":
      patch.whatsappId = channelId;
      break;
    case "instagram":
      patch.instagramId = channelId;
      break;
    case "facebook":
      patch.fbPsid = channelId;
      break;
  }
  return patch;
}

function safeBigInt(v: string): bigint {
  try {
    return BigInt(v);
  } catch {
    return BigInt(0);
  }
}
