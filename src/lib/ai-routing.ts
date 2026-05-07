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
- Если в одном разговоре у клиента ДВА запроса разных специализаций (пример: "тур в Самарканд И тур в Китай") — вызови route_to_specialist ДВАЖДЫ, по разу на каждую специализацию. Каждому специалисту прилетит своё уведомление.
- Если запрос не подходит ни одному специалисту — используй обычный notify_manager.`;
}

/**
 * Выполнение tool route_to_specialist.
 *
 * Логика:
 *  1. Находим staff (валидный, acceptsLeads)
 *  2. assignedStaffId логика:
 *     - если у клиента ещё НЕТ assignedStaffId → ставим этого специалиста как «основного»
 *     - если уже назначен ТОТ ЖЕ специалист → ничего не меняем
 *     - если уже назначен ДРУГОЙ специалист → НЕ перезаписываем (continuity для основного
 *       контакта). Но всё равно отправляем уведомление новому специалисту — это второй
 *       параллельный запрос (например клиент пишет про тур в Самарканд И в Китай).
 *  3. ВСЕГДА отправляем Telegram-уведомление matched staff (или owner fallback).
 *     Это критично — без этого AI считает что направил, а специалист ничего не получил.
 *
 * Раньше была проблема: tool устанавливал assignedStaffId, и потом надеялся что AI
 * вызовет notify_manager для уведомления. Если AI не вызывал — специалист не знал.
 * Теперь tool сам отправляет уведомление.
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
  delivered?: boolean;
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
        telegramChatId: true,
        notificationsEnabled: true,
      },
    });

    if (!staff) {
      return {
        success: false,
        error: "Специалист не найден или отключён от приёма лидов. Используй notify_manager.",
      };
    }

    // Достаём бизнес для уведомления (botToken + ownerTelegramChatId как fallback)
    const business = await prisma.business.findUnique({
      where: { id: params.businessId },
      select: { botToken: true, ownerTelegramChatId: true, name: true },
    });

    // Проверяем текущее назначение клиента
    const existing = await prisma.client.findUnique({
      where: {
        businessId_telegramId: {
          businessId: params.businessId,
          telegramId: params.clientTelegramId,
        },
      },
      select: { assignedStaffId: true, name: true, phone: true },
    });

    const alreadyAssignedToOther =
      existing?.assignedStaffId && existing.assignedStaffId !== staff.id;
    let currentMainStaffName: string | null = null;

    if (alreadyAssignedToOther) {
      // НЕ перезаписываем основного менеджера, но уведомление этому specialist'у всё равно отправим
      const current = await prisma.staff.findUnique({
        where: { id: existing!.assignedStaffId! },
        select: { name: true },
      });
      currentMainStaffName = current?.name || null;
    } else {
      // Либо клиент новый, либо назначен на этого же staff — ставим / подтверждаем
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
    }

    // Отправляем уведомление matched staff. Если у него нет telegramChatId или
    // notifications отключены — fallback на ownerTelegramChatId. Если и его нет —
    // лог-предупреждение, но возвращаем success (запись в БД сделана).
    const targetChatId =
      staff.notificationsEnabled !== false && staff.telegramChatId
        ? staff.telegramChatId
        : business?.ownerTelegramChatId ?? null;

    const targetLabel =
      staff.notificationsEnabled !== false && staff.telegramChatId
        ? `staff "${staff.name}"`
        : "owner (fallback)";

    let delivered = false;

    const clientLabel = existing?.name
      ? `👤 ${existing.name}${existing.phone ? ` · ${existing.phone}` : ""}`
      : `👤 Клиент (Telegram ID: ${params.clientTelegramId.toString()})`;

    const headerLabel = alreadyAssignedToOther
      ? `📩 Дополнительный запрос (основной менеджер: ${currentMainStaffName || "—"})`
      : `📩 Новый клиент направлен Вам`;

    const text =
      `${headerLabel}\n\n` +
      `${clientLabel}\n` +
      `Специализация: ${staff.name}\n` +
      `Причина роутинга: ${params.reason}\n\n` +
      `Клиент ждёт ответа в Telegram.`;

    if (business?.botToken && targetChatId) {
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${business.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChatId.toString(),
              text,
              // Plain text — без parse_mode, чтобы спецсимволы в имени клиента не сломали отправку
            }),
          }
        );
        if (tgRes.ok) {
          delivered = true;
          console.log(`[ai-routing] notification delivered to ${targetLabel} (chat=${targetChatId})`);
        } else {
          const body = await tgRes.text().catch(() => "");
          console.error(
            `[ai-routing] TG notification FAILED ${tgRes.status}: ${body.slice(0, 200)}`
          );
        }
      } catch (e) {
        console.error("[ai-routing] TG notification error:", e);
      }
    } else {
      console.warn(
        `[ai-routing] No notification sent: botToken=${!!business?.botToken}, targetChatId=${targetChatId}`
      );
    }

    console.log(
      `[ai-routing] business=${params.businessId} routed to staff=${staff.id} (${staff.name}) ${alreadyAssignedToOther ? "[multi-route, main stays " + currentMainStaffName + "]" : "[primary]"}. Reason: ${params.reason.slice(0, 100)}`
    );

    return {
      success: true,
      message: alreadyAssignedToOther
        ? `Доп. запрос направлен специалисту ${staff.name}. Основной менеджер клиента остался ${currentMainStaffName || "прежний"}.`
        : `Клиент направлен специалисту ${staff.name}.`,
      staffName: staff.name,
      delivered,
    };
  } catch (error) {
    console.error("[ai-routing] executeRouteToSpecialist failed:", error);
    return {
      success: false,
      error: "Внутренняя ошибка при назначении специалиста",
    };
  }
}
