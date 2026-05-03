/**
 * Lead → client deal pipeline helpers.
 *
 * Stages are intentionally ordered. Auto-promotion only moves a client
 * FORWARD in the funnel. Once a client reaches a terminal state ("client"
 * or "lost"), automatic events do not pull them back — that's a manager
 * judgement call.
 *
 *   lead (0) → consultation_booked (1) → consultation_done (2) → client (3)
 *                                                              ↘ lost (terminal)
 */

import { prisma } from "@/lib/prisma";

export type DealStage =
  | "lead"
  | "consultation_booked"
  | "consultation_done"
  | "client"
  | "lost";

const STAGE_RANK: Record<DealStage, number> = {
  lead: 0,
  consultation_booked: 1,
  consultation_done: 2,
  client: 3,
  lost: -1, // terminal — never auto-moved out of
};

const TERMINAL_STAGES: DealStage[] = ["client", "lost"];

/**
 * Move a client forward in the pipeline. No-op if:
 *   - the client is already at a higher stage,
 *   - the client is in a terminal state (client / lost),
 *   - the client doesn't exist.
 *
 * Optionally records a sale value (in business-chosen units, e.g. UZS / RUB / USD)
 * — used when promoting to "client" via Order creation.
 *
 * Failures are swallowed to a console warn — pipeline movement is a UX nicety,
 * not a blocking concern. The booking / order it's reacting to has already
 * been persisted by the caller.
 */
export async function promoteDealStage(
  clientId: string,
  newStage: DealStage,
  saleValue?: number
): Promise<void> {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { dealStage: true, dealValue: true },
    });
    if (!client) return;

    const current = (client.dealStage as DealStage) || "lead";
    if (TERMINAL_STAGES.includes(current)) return;

    const newRank = STAGE_RANK[newStage];
    const currentRank = STAGE_RANK[current];
    if (newRank <= currentRank) return;

    const data: {
      dealStage: DealStage;
      dealClosedAt: Date | null;
      dealValue?: number;
    } = {
      dealStage: newStage,
      dealClosedAt: newStage === "client" || newStage === "lost" ? new Date() : null,
    };
    // Set dealValue only when promoting to "client" and a value was provided
    // and either the existing value is null or smaller (don't overwrite a
    // larger manually-entered figure with a smaller order).
    if (newStage === "client" && typeof saleValue === "number" && saleValue > 0) {
      const existing = client.dealValue ?? 0;
      data.dealValue = Math.max(existing, Math.round(saleValue));
    }

    await prisma.client.update({
      where: { id: clientId },
      data,
    });
  } catch (error) {
    console.warn(`promoteDealStage(${clientId}, ${newStage}) failed:`, error);
  }
}

/**
 * Same as promoteDealStage but takes (businessId, telegramId) to look up
 * the Client first. Convenient for booking / order code paths that have
 * the Telegram identity, not the Client.id.
 */
export async function promoteDealStageByTelegram(
  businessId: string,
  telegramId: bigint,
  newStage: DealStage,
  saleValue?: number
): Promise<void> {
  try {
    const client = await prisma.client.findUnique({
      where: { businessId_telegramId: { businessId, telegramId } },
      select: { id: true },
    });
    if (!client) return;
    await promoteDealStage(client.id, newStage, saleValue);
  } catch (error) {
    console.warn(`promoteDealStageByTelegram(${businessId}, ${telegramId}) failed:`, error);
  }
}
