/**
 * Журнал активности бота — записывает события для отображения клиенту в
 * /dashboard/activity. Заменяет необходимость давать клиенту доступ к
 * Vercel-логам.
 *
 * Изоляция: API endpoint фильтрует по businessId сессии — клиент видит
 * только свои события.
 *
 * Best-effort запись: ошибки лога НЕ должны валить основной флоу. Если БД
 * недоступна или схема ещё не применена — просто log.error и продолжаем.
 *
 * Все вызовы НЕ-await: логирование fire-and-forget. Не блокирует webhook
 * или ответ AI клиенту.
 *
 * Технические детали (technical) кладём compact JSON: model, latency,
 * http_status, errorCode, stack — то что нужно девопсу при дебаге.
 *
 * @example
 * void logActivity({
 *   businessId,
 *   type: "ai_response",
 *   summary: `AI ответил клиенту (${latencyMs}мс, ${tokens} ток.)`,
 *   technical: { model, tokens, latency: latencyMs, stop_reason },
 *   channel: "telegram",
 *   clientId: client.id,
 * });
 */

import { prisma } from "@/lib/prisma";

export type ActivitySeverity = "info" | "warn" | "error";

export type ActivityType =
  | "message_received"
  | "message_sent"
  | "ai_response"
  | "tool_called"
  | "notification_sent"
  | "client_assigned"
  | "booking_created"
  | "order_created"
  | "payment_received"
  | "error";

export interface LogActivityParams {
  businessId: string;
  type: ActivityType | string; // open enum
  severity?: ActivitySeverity;
  summary: string;
  technical?: Record<string, unknown>;
  channel?: string | null;
  clientId?: string | null;
  staffId?: string | null;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.businessActivityLog.create({
      data: {
        businessId: params.businessId,
        type: params.type,
        severity: params.severity || "info",
        summary: params.summary.slice(0, 500), // защита от слишком длинных строк
        technical: (params.technical as object) || undefined,
        channel: params.channel || null,
        clientId: params.clientId || null,
        staffId: params.staffId || null,
      },
    });
  } catch (e) {
    // Не валим основной флоу. Просто фиксим в Vercel логах.
    console.error("[activity-log] failed to write entry:", e);
  }
}

/**
 * Удобная обёртка без необходимости await — для fire-and-forget из горячего пути.
 */
export function logActivityFireAndForget(params: LogActivityParams): void {
  logActivity(params).catch(() => {
    // Уже залогировано внутри logActivity — просто проглатываем здесь.
  });
}
