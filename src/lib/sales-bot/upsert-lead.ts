/**
 * Unified upsert helper for SalesLead across all channels (TG/WA/IG).
 *
 * До 23 июля 2026 upsert-логика была продублирована в трёх webhook-роутах
 * (sales-bot/telegram, sales-bot/whatsapp, sales-bot/instagram). Каждый
 * писал свой блок с полями stage: "new" / channel: <chan>, а любое
 * изменение (новое поле, timezone, tag, привязка к рекламе) требовало
 * править одно и то же в 3 местах.
 *
 * Модель одна — SalesLead — а identity зависит от канала (telegramChatId
 * / whatsappPhone / instagramId), поэтому helper принимает discriminated
 * union и внутри выбирает where/create/update.
 */

import { prisma } from "@/lib/prisma";

export type SalesLeadUpsertInput =
  | {
      channel: "telegram";
      telegramId: bigint;
      telegramChatId: bigint;
      telegramUsername?: string | null;
      name: string;
    }
  | {
      channel: "whatsapp";
      whatsappPhone: string;
      name: string;
    }
  | {
      channel: "instagram" | "facebook";
      instagramId: string;
      name: string;
    };

export async function upsertSalesLead(input: SalesLeadUpsertInput): Promise<void> {
  try {
    if (input.channel === "telegram") {
      await prisma.salesLead.upsert({
        where: { telegramChatId: input.telegramChatId },
        create: {
          telegramId: input.telegramId,
          telegramUsername: input.telegramUsername || null,
          telegramChatId: input.telegramChatId,
          name: input.name,
          channel: "telegram",
          stage: "new",
        },
        update: {
          name: input.name,
          telegramUsername: input.telegramUsername || undefined,
          updatedAt: new Date(),
        },
      });
      return;
    }

    if (input.channel === "whatsapp") {
      await prisma.salesLead.upsert({
        where: { whatsappPhone: input.whatsappPhone },
        create: {
          whatsappPhone: input.whatsappPhone,
          name: input.name,
          channel: "whatsapp",
          stage: "new",
        },
        update: {
          name: input.name,
          updatedAt: new Date(),
        },
      });
      return;
    }

    // instagram | facebook
    await prisma.salesLead.upsert({
      where: { instagramId: input.instagramId },
      create: {
        instagramId: input.instagramId,
        channel: input.channel,
        name: input.name,
        stage: "new",
      },
      update: {
        ...(input.name ? { name: input.name } : {}),
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    // Соответствует прежнему поведению всех трёх callsite'ов: upsert-фейл
    // (например отсутствующий unique-index) не должен ломать основной ответ.
    console.error(`[upsertSalesLead] ${input.channel} failed:`, e);
  }
}
