/**
 * AI smart routing — направление клиента к специалисту через AI.
 *
 * Когда `Business.leadAssignmentMode === "ai_smart"` и в команде есть staff
 * с заполненным `routingDescription`, бот получает дополнительный tool
 * `route_to_specialist` с динамическим enum staff_id. AI читает описания
 * команды (на естественном языке от владельца) и направляет клиента в
 * нужного специалиста.
 *
 * Безопасность: enum в tool input_schema жёстко ограничивает выбор —
 * Anthropic API физически не пропустит несуществующий staff_id.
 *
 * Continuity: если у клиента уже есть assignedStaffId — НЕ перезаписываем,
 * только уведомляем текущего специалиста. Иначе клиента бы перекидывали
 * между менеджерами при каждом сообщении с новым контекстом.
 */

import { prisma } from "@/lib/prisma";

export interface RoutableStaff {
  id: string;
  name: string;
  routingDescription: string;
  role: string | null;
  acceptsLeads: boolean;
}

/**
 * Загружает staff бизнеса, у которых есть routingDescription и acceptsLeads.
 * Возвращает пустой массив если режим не ai_smart или таких staff нет.
 *
 * НЕ трогаем существующий поток — пустой массив значит «не инжектим tool».
 */
export async function loadRoutableStaff(businessId: string): Promise<RoutableStaff[]> {
  try {
    const staff = await prisma.staff.findMany({
      where: {
        businessId,
        acceptsLeads: true,
        routingDescription: { not: null },
      },
      select: {
        id: true,
        name: true,
        routingDescription: true,
        role: true,
        acceptsLeads: true,
      },
      orderBy: { name: "asc" },
    });
    return staff
      .filter((s): s is RoutableStaff => Boolean(s.routingDescription?.trim()))
      .map((s) => ({
        id: s.id,
        name: s.name,
        routingDescription: s.routingDescription!.trim(),
        role: s.role,
        acceptsLeads: s.acceptsLeads,
      }));
  } catch (e) {
    console.error("[ai-routing] loadRoutableStaff failed:", e);
    return [];
  }
}

/**
 * Строит динамический tool definition с enum'ом staff_id для конкретного бизнеса.
 * Возвращает null если у бизнеса меньше 2 routable staff (роутить некуда).
 *
 * eslint-disable нужен — Anthropic SDK типы не строгие про tool definitions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRouteToSpecialistTool(staff: RoutableStaff[]): any | null {
  // С одним специалистом роутить некуда — пусть AI использует стандартный notify_manager
  if (staff.length < 2) return null;

  return {
    name: "route_to_specialist",
    description:
      "Назначить клиента специалисту с подходящей специализацией. Используй когда из контекста разговора понятно к кому именно из команды относится запрос. Если контекст неясен — НЕ вызывай tool, задай уточняющий вопрос. Назначение происходит ОДИН РАЗ — повторно тот же специалист уведомляется автоматически.",
    input_schema: {
      type: "object",
      properties: {
        staff_id: {
          type: "string",
          enum: staff.map((s) => s.id),
          description: `ID специалиста к которому направить клиента. Доступные: ${staff
            .map((s) => `${s.id}=${s.name}`)
            .join(", ")}`,
        },
        reason: {
          type: "string",
          description: "Краткое обоснование почему именно этот специалист (1 предложение, для аудита)",
        },
      },
      required: ["staff_id", "reason"],
    },
  };
}

/**
 * Строит блок системного промпта со списком команды и их специализациями.
 * Возвращает пустую строку если staff меньше 2.
 */
export function buildRoutingPromptSection(staff: RoutableStaff[]): string {
  if (staff.length < 2) return "";

  const list = staff
    .map((s, i) => {
      const roleLabel = s.role ? ` (${s.role})` : "";
      return `${i + 1}. ${s.name}${roleLabel} — id: ${s.id}\n   Специализация: ${s.routingDescription}`;
    })
    .join("\n\n");

  return `\n\n=== КОМАНДА И СПЕЦИАЛИЗАЦИИ ===
В этом бизнесе работают несколько специалистов с разной специализацией:

${list}

ПРАВИЛО РОУТИНГА:
- Когда из разговора ПОНЯТНО к какой специализации относится запрос клиента — вызови tool route_to_specialist с подходящим staff_id.
- Если контекст НЕЯСЕН (клиент только что написал, мало деталей) — НЕ вызывай tool, задай уточняющий вопрос.
- Tool вызывай ОДИН раз за разговор. Если клиент уже назначен — продолжай работать как обычно.
- Если запрос не подходит ни одному специалисту — используй обычный notify_manager.`;
}

/**
 * Выполнение tool route_to_specialist.
 *
 * Проверяет:
 *  - staff существует в этом бизнесе и acceptsLeads
 *  - У клиента ещё нет assignedStaffId (continuity — не перекидываем)
 *
 * Возвращает результат для AI:
 *  - success=true с именем специалиста и сообщением
 *  - error если staff не найден или клиент уже назначен другому
 */
export async function executeRouteToSpecialist(params: {
  businessId: string;
  clientTelegramId: bigint;
  staffId: string;
  reason: string;
}): Promise<{
  success: boolean;
  message?: string;
  staffName?: string;
  error?: string;
}> {
  try {
    const staff = await prisma.staff.findFirst({
      where: {
        id: params.staffId,
        businessId: params.businessId,
        acceptsLeads: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!staff) {
      return {
        success: false,
        error: "Специалист не найден или отключён от приёма лидов. Используй notify_manager.",
      };
    }

    // Continuity: проверяем не назначен ли клиент уже другому специалисту.
    // Если назначен — НЕ перезаписываем (иначе клиента бы перекидывало между
    // менеджерами при каждом сообщении с новым контекстом).
    const existing = await prisma.client.findUnique({
      where: {
        businessId_telegramId: {
          businessId: params.businessId,
          telegramId: params.clientTelegramId,
        },
      },
      select: { assignedStaffId: true },
    });

    if (existing?.assignedStaffId && existing.assignedStaffId !== staff.id) {
      const currentStaff = await prisma.staff.findUnique({
        where: { id: existing.assignedStaffId },
        select: { name: true },
      });
      return {
        success: true,
        message: `Клиент уже работает с ${currentStaff?.name || "другим специалистом"} — продолжайте диалог.`,
        staffName: currentStaff?.name || undefined,
      };
    }

    await prisma.client.upsert({
      where: {
        businessId_telegramId: {
          businessId: params.businessId,
          telegramId: params.clientTelegramId,
        },
      },
      create: {
        businessId: params.businessId,
        telegramId: params.clientTelegramId,
        assignedStaffId: staff.id,
      },
      update: {
        assignedStaffId: staff.id,
      },
    });

    console.log(
      `[ai-routing] business=${params.businessId} routed to staff=${staff.id} (${staff.name}). Reason: ${params.reason.slice(0, 100)}`
    );

    return {
      success: true,
      message: `Клиент направлен к специалисту ${staff.name}. Менеджер получит уведомление о новом запросе.`,
      staffName: staff.name,
    };
  } catch (error) {
    console.error("[ai-routing] executeRouteToSpecialist failed:", error);
    return {
      success: false,
      error: "Внутренняя ошибка при назначении специалиста",
    };
  }
}
