/**
 * Sprint 4E (M28) — Loyalty Ledger.
 *
 * Единая точка мутации Client.loyaltyPoints + запись в LoyaltyLedger
 * в одной транзакции. Раньше баллы менялись прямыми prisma.client.update
 * в разных местах (booking-tools, sales-tools, admin API) — не было
 * возможности показать владельцу «за что клиент получил эти 500 баллов».
 * Теперь любое изменение делает эту функцию.
 *
 * kind:
 *   earn      — начисление за визит/покупку/бронирование (autor вычисляет система)
 *   spend     — списание при оплате баллами
 *   expire    — сгорание по срокам программы (крон в будущем)
 *   manual    — начисление/списание менеджером вручную из карточки клиента
 *   adjustment— техническая правка (миграция/backfill)
 *
 * points принимается знаковым: +N — начисление, -N — списание. Client
 * не уходит в минус: если запрошено больше чем есть — списывается сколько
 * возможно, а в ledger пишется фактическая величина.
 */

import { prisma } from "@/lib/prisma";

export type LoyaltyKind = "earn" | "spend" | "expire" | "manual" | "adjustment";

export interface WriteLedgerInput {
  businessId: string;
  clientId: string;
  kind: LoyaltyKind;
  points: number; // signed; +N earn/manual, -N spend/expire
  reason?: string | null;
  relatedId?: string | null;
  createdBy?: string | null; // "system" | staff.id | "manager"
}

export interface LedgerEntry {
  id: string;
  kind: string;
  points: number;
  reason: string | null;
  relatedId: string | null;
  createdBy: string | null;
  createdAt: Date;
}

/**
 * Записывает движение баллов и обновляет Client.loyaltyPoints в одной
 * транзакции. Возвращает актуальный баланс + запись ledger.
 * Возвращает null если точки нулевые (нет движения — ничего не пишем).
 */
export async function writeLoyaltyLedger(
  input: WriteLedgerInput
): Promise<{ balance: number; entry: LedgerEntry } | null> {
  const { businessId, clientId, kind, points, reason, relatedId, createdBy } = input;

  if (!Number.isFinite(points) || points === 0) return null;

  // Клиент нужен для расчёта фактического списания (не даём уйти в минус)
  const client = await prisma.client.findFirst({
    where: { id: clientId, businessId },
    select: { id: true, loyaltyPoints: true },
  });
  if (!client) throw new Error(`Client ${clientId} not found in business ${businessId}`);

  // Ограничиваем списание балансом
  let effectivePoints = Math.trunc(points);
  if (effectivePoints < 0 && Math.abs(effectivePoints) > client.loyaltyPoints) {
    effectivePoints = -client.loyaltyPoints;
    if (effectivePoints === 0) return null; // списывать нечего — ничего не пишем
  }

  const [entry, updated] = await prisma.$transaction([
    prisma.loyaltyLedger.create({
      data: {
        businessId,
        clientId,
        kind,
        points: effectivePoints,
        reason: reason ?? null,
        relatedId: relatedId ?? null,
        createdBy: createdBy ?? null,
      },
    }),
    prisma.client.update({
      where: { id: clientId },
      data: {
        loyaltyPoints:
          effectivePoints >= 0
            ? { increment: effectivePoints }
            : { decrement: Math.abs(effectivePoints) },
      },
      select: { loyaltyPoints: true },
    }),
  ]);

  return {
    balance: updated.loyaltyPoints,
    entry: {
      id: entry.id,
      kind: entry.kind,
      points: entry.points,
      reason: entry.reason,
      relatedId: entry.relatedId,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
    },
  };
}

/**
 * Читает историю движений для клиента (последние N штук).
 * Возвращает по createdAt DESC — свежее первым, как показываем в UI.
 */
export async function readLoyaltyLedger(
  businessId: string,
  clientId: string,
  limit = 100
): Promise<LedgerEntry[]> {
  const rows = await prisma.loyaltyLedger.findMany({
    where: { businessId, clientId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    points: r.points,
    reason: r.reason,
    relatedId: r.relatedId,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}

/**
 * Валидация значения points для записей от менеджера (manual). Хочу
 * ограничить как «разумные» значения чтобы менеджер случайно не начислил
 * 999999999 баллов, обходя UI. Границы можно поднять если бизнесу нужно.
 */
export function isReasonableManualPoints(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isFinite(n) &&
    Math.abs(n) <= 100_000 &&
    Math.trunc(n) === n
  );
}
