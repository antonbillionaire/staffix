/**
 * Tool dispatch для Telegram бота.
 *
 * handleToolCall — обрабатывает booking-tools (check_availability / create_booking /
 * notify_manager / update_lead_status / save_client_note / etc).
 * Sales-tools (search_products / create_order / etc) идут напрямую через
 * executeSalesTool из @/lib/sales-tools — здесь не дублируется.
 *
 * buildFallbackFromToolResults — если Claude вернул только tool_use без текста
 * (или упал на повторном вызове), достаём осмысленный ответ из результатов tool'ов.
 * Это страховка от "пустого ответа" клиенту.
 */

import {
  checkAvailability,
  createBooking,
  getServicesList,
  getStaffList,
  getClientBookings,
  cancelBooking,
  updateLeadStatus,
} from "@/lib/booking-tools";
import { dispatchCrmEvent } from "@/lib/crm-integrations";
import { notifyManagerByTelegram } from "@/lib/sales-tools";

export async function handleToolCall(
  toolName: string,
  toolInput: Record<string, string>,
  businessId: string,
  telegramId: bigint
): Promise<string> {
  try {
    switch (toolName) {
      case "check_availability": {
        const results = await checkAvailability(
          businessId,
          toolInput.date,
          toolInput.service_id,
          toolInput.staff_id
        );
        return JSON.stringify(results);
      }

      case "create_booking": {
        const result = await createBooking(
          businessId,
          toolInput.date,
          toolInput.time,
          toolInput.client_name,
          telegramId,
          toolInput.service_id,
          toolInput.staff_id,
          toolInput.client_phone
        );
        // Dispatch CRM event (non-blocking)
        if (result.success && result.bookingId) {
          dispatchCrmEvent(businessId, "booking_created", {
            client: {
              name: toolInput.client_name || null,
              phone: toolInput.client_phone || null,
              telegramId: String(telegramId),
              totalVisits: 0,
              tags: [],
            },
            booking: {
              id: result.bookingId,
              service: result.details?.serviceName || null,
              master: result.details?.staffName || null,
              date: `${toolInput.date}T${toolInput.time}:00Z`,
              price: null,
              status: "confirmed",
              clientName: toolInput.client_name || "",
              clientPhone: toolInput.client_phone || null,
            },
          }).catch(() => {});
        }
        return JSON.stringify(result);
      }

      case "get_services": {
        const services = await getServicesList(businessId);
        return JSON.stringify(services);
      }

      case "get_staff": {
        const staff = await getStaffList(businessId);
        return JSON.stringify(staff);
      }

      case "get_my_bookings": {
        const bookings = await getClientBookings(businessId, telegramId);
        return JSON.stringify(bookings);
      }

      case "cancel_booking": {
        const result = await cancelBooking(toolInput.booking_id, telegramId);
        if (result.success) {
          dispatchCrmEvent(businessId, "booking_cancelled", {
            client: {
              name: null,
              phone: null,
              telegramId: String(telegramId),
              totalVisits: 0,
              tags: [],
            },
            booking: {
              id: toolInput.booking_id,
              service: null,
              master: null,
              date: new Date().toISOString(),
              price: null,
              status: "cancelled",
              clientName: "",
              clientPhone: null,
            },
          }).catch(() => {});
        }
        return JSON.stringify(result);
      }

      case "notify_manager": {
        const result = await notifyManagerByTelegram(
          businessId,
          telegramId,
          toolInput.reason,
          toolInput.client_name,
          toolInput.urgency
        );
        // Also drop a Task into the dashboard so the manager has a persistent
        // record, not just a Telegram ping. Best-effort — errors only logged.
        const { createEscalationTask } = await import("@/lib/tasks");
        createEscalationTask({
          businessId,
          clientTelegramId: telegramId,
          clientName: toolInput.client_name,
          reason: toolInput.reason || "AI попросил человека",
          urgency: toolInput.urgency,
        }).catch(() => {});
        return JSON.stringify(result);
      }

      case "update_lead_status": {
        const result = await updateLeadStatus(
          businessId,
          telegramId.toString(),
          "telegram",
          toolInput.status,
          toolInput.reason
        );
        return JSON.stringify(result);
      }

      case "save_client_note": {
        const { appendClientImportantNote } = await import("@/lib/booking-tools");
        const result = await appendClientImportantNote(
          businessId,
          telegramId,
          toolInput.note
        );
        return JSON.stringify(result);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Error in tool ${toolName}:`, error);
    return JSON.stringify({ error: "Ошибка выполнения инструмента" });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFallbackFromToolResults(toolResults: any[], salesMode: boolean): string {
  for (const tr of toolResults) {
    try {
      const parsed = JSON.parse(tr.content);
      if (!parsed.success) continue;

      // Order confirmation (sales mode)
      if (parsed.orderNumber && parsed.totalPrice !== undefined) {
        const items =
          parsed.summary ||
          parsed.items?.map((i: { name: string; quantity: number }) => `${i.name} × ${i.quantity}`).join(", ") ||
          "";
        return `Заказ ${parsed.orderNumber} оформлен! 🎉\n\n${items}\nИтого: ${parsed.totalPrice.toLocaleString("ru-RU")} сум\n\nСпасибо за покупку! Мы скоро свяжемся с вами.`;
      }

      // Booking confirmation (service mode)
      if (parsed.details) {
        const d = parsed.details;
        if (d.serviceName && d.staffName) {
          return `Запись создана! ✅\n\n${d.serviceName} к мастеру ${d.staffName}\n📅 ${d.date} в ${d.time}\n\nЖдём вас!`;
        }
      }

      // Generic success with message
      if (parsed.message) {
        return parsed.message;
      }
    } catch {
      /* not JSON */
    }
  }
  return salesMode
    ? "Ваш запрос обработан! Если есть вопросы — напишите."
    : "Готово! Чем ещё могу помочь?";
}
