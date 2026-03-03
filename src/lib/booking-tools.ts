/**
 * Booking Tools for AI Bot
 * Functions that Claude can call via tool_use to check availability and create bookings
 */

import { prisma } from "./prisma";
import { localToUTC } from "./automation";
import { sendBookingNotification } from "./notifications";

// ========================================
// TYPES
// ========================================

interface TimeSlot {
  time: string; // "HH:MM"
  available: boolean;
}

interface AvailabilityResult {
  date: string;
  staffName: string;
  staffId: string;
  serviceName: string;
  serviceDuration: number;
  availableSlots: string[]; // ["09:00", "10:00", ...]
}

interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  details?: {
    date: string;
    time: string;
    staffName: string;
    serviceName: string;
    clientName: string;
  };
}

// ========================================
// WORKING HOURS PARSER
// ========================================

/**
 * Parse working hours string into start/end times
 * Supports formats like:
 * - "09:00-18:00"
 * - "9:00 - 18:00"
 * - "Пн-Пт: 09:00-18:00, Сб: 10:00-16:00"
 * - "с 9 до 18"
 * Falls back to 09:00-18:00 if can't parse
 */
export function parseWorkingHours(
  workingHoursStr: string | null,
  date: Date
): { startHour: number; startMinute: number; endHour: number; endMinute: number } {
  const defaultHours = { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0 };

  if (!workingHoursStr) return defaultHours;

  // Try to extract time range like "09:00-18:00" or "9:00 - 18:00"
  const timeRangeRegex = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/;

  // Check if there are day-specific hours
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ...

  // Map of day abbreviations (Russian)
  const dayMap: Record<string, number[]> = {
    "пн": [1], "вт": [2], "ср": [3], "чт": [4], "пт": [5], "сб": [6], "вс": [0],
    "пн-пт": [1, 2, 3, 4, 5],
    "пн-сб": [1, 2, 3, 4, 5, 6],
    "будни": [1, 2, 3, 4, 5],
  };

  // Try to find day-specific hours
  const parts = workingHoursStr.split(/[,;]/);
  for (const part of parts) {
    const lowerPart = part.toLowerCase().trim();

    // Check if this part applies to the target day
    let appliesToDay = false;
    for (const [dayKey, days] of Object.entries(dayMap)) {
      if (lowerPart.includes(dayKey) && days.includes(dayOfWeek)) {
        appliesToDay = true;
        break;
      }
    }

    if (appliesToDay || parts.length === 1) {
      const match = part.match(timeRangeRegex);
      if (match) {
        return {
          startHour: parseInt(match[1]),
          startMinute: parseInt(match[2]),
          endHour: parseInt(match[3]),
          endMinute: parseInt(match[4]),
        };
      }
    }
  }

  // Fallback: try simple "с X до Y" format
  const simpleMatch = workingHoursStr.match(/с\s*(\d{1,2})\s*до\s*(\d{1,2})/i);
  if (simpleMatch) {
    return {
      startHour: parseInt(simpleMatch[1]),
      startMinute: 0,
      endHour: parseInt(simpleMatch[2]),
      endMinute: 0,
    };
  }

  // Last resort: try any time range in the string
  const fallbackMatch = workingHoursStr.match(timeRangeRegex);
  if (fallbackMatch) {
    return {
      startHour: parseInt(fallbackMatch[1]),
      startMinute: parseInt(fallbackMatch[2]),
      endHour: parseInt(fallbackMatch[3]),
      endMinute: parseInt(fallbackMatch[4]),
    };
  }

  return defaultHours;
}

// ========================================
// CHECK AVAILABILITY
// ========================================

/**
 * Get available time slots for a given date, service, and optionally staff
 */
export async function checkAvailability(
  businessId: string,
  dateStr: string, // "YYYY-MM-DD"
  serviceId?: string,
  staffId?: string
): Promise<AvailabilityResult[]> {
  // Load business info
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { workingHours: true, timezone: true },
  });

  const tz = business?.timezone ?? null;

  // Parse the target date (using local midnight for working hours parsing)
  const targetDate = new Date(dateStr + "T00:00:00Z");
  if (isNaN(targetDate.getTime())) {
    return [];
  }

  // Get working hours for this day
  const hours = parseWorkingHours(business?.workingHours || null, targetDate);

  // Load service (for duration)
  let serviceDuration = 60; // default 60 minutes
  let serviceName = "Услуга";

  if (serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { name: true, duration: true },
    });
    if (service) {
      serviceDuration = service.duration;
      serviceName = service.name;
    }
  }

  // Load staff members (with their schedules)
  let staffMembers: Array<{ id: string; name: string }>;
  if (staffId) {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true },
    });
    staffMembers = staff ? [staff] : [];
  } else {
    staffMembers = await prisma.staff.findMany({
      where: { businessId },
      select: { id: true, name: true },
    });
  }

  // If no staff registered, create a virtual "any" staff entry
  if (staffMembers.length === 0) {
    staffMembers = [{ id: "__any__", name: "Любой мастер" }];
  }

  // Load staff schedules for this day of the week
  const dayOfWeek = targetDate.getUTCDay(); // 0=Sun ... 6=Sat
  const staffIds = staffMembers.filter((s) => s.id !== "__any__").map((s) => s.id);
  const staffSchedules = staffIds.length > 0
    ? await prisma.staffSchedule.findMany({
        where: { staffId: { in: staffIds }, dayOfWeek },
      })
    : [];

  // Load time-offs that overlap with this date
  const dateStart = new Date(dateStr + "T00:00:00.000Z");
  const dateEnd = new Date(dateStr + "T23:59:59.999Z");
  const staffTimeOffs = staffIds.length > 0
    ? await prisma.staffTimeOff.findMany({
        where: {
          staffId: { in: staffIds },
          startDate: { lte: dateEnd },
          endDate: { gte: dateStart },
        },
      })
    : [];

  // Get all bookings for this date (convert local day boundaries to UTC)
  const dayStart = localToUTC(dateStr, "00:00", tz);
  const dayEnd = localToUTC(dateStr, "23:59", tz);

  const existingBookings = await prisma.booking.findMany({
    where: {
      businessId,
      date: { gte: dayStart, lte: dayEnd },
      status: { in: ["pending", "confirmed"] },
    },
    include: {
      service: { select: { duration: true } },
    },
  });

  const results: AvailabilityResult[] = [];

  for (const staffMember of staffMembers) {
    // Check if staff has a time-off (vacation/sick) on this date
    const hasTimeOff = staffTimeOffs.some((t) => t.staffId === staffMember.id);
    if (hasTimeOff) {
      results.push({
        date: dateStr,
        staffName: staffMember.name,
        staffId: staffMember.id,
        serviceName,
        serviceDuration,
        availableSlots: [], // On time-off — no slots
      });
      continue;
    }

    // Check staff-specific schedule for this day
    const staffSchedule = staffSchedules.find((s) => s.staffId === staffMember.id);

    // If staff has a schedule and it's a day off, skip
    if (staffSchedule && !staffSchedule.isWorkday) {
      results.push({
        date: dateStr,
        staffName: staffMember.name,
        staffId: staffMember.id,
        serviceName,
        serviceDuration,
        availableSlots: [], // Day off — no slots
      });
      continue;
    }

    // Determine working hours: staff schedule > business hours
    let staffHours = hours; // default from business
    if (staffSchedule && staffSchedule.isWorkday) {
      const [sh, sm] = staffSchedule.startTime.split(":").map(Number);
      const [eh, em] = staffSchedule.endTime.split(":").map(Number);
      staffHours = { startHour: sh, startMinute: sm, endHour: eh, endMinute: em };
    }

    // Filter bookings for this staff member
    const staffBookings = staffMember.id === "__any__"
      ? existingBookings
      : existingBookings.filter((b) => b.staffId === staffMember.id || b.staffId === null);

    // Generate time slots
    const availableSlots: string[] = [];

    // Iterate through the day in 30-min increments
    let currentHour = staffHours.startHour;
    let currentMinute = staffHours.startMinute;

    while (
      currentHour < staffHours.endHour ||
      (currentHour === staffHours.endHour && currentMinute < staffHours.endMinute)
    ) {
      const timeStr = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
      const slotStart = localToUTC(dateStr, timeStr, tz);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);

      // Check if slot end exceeds working hours
      const workEndStr = `${staffHours.endHour.toString().padStart(2, "0")}:${staffHours.endMinute.toString().padStart(2, "0")}`;
      const workEnd = localToUTC(dateStr, workEndStr, tz);

      if (slotEnd > workEnd) {
        break;
      }

      // Check if this slot conflicts with any existing booking
      let hasConflict = false;
      for (const booking of staffBookings) {
        const bookingStart = new Date(booking.date);
        const bookingDuration = booking.service?.duration || 60;
        const bookingEnd = new Date(bookingStart);
        bookingEnd.setMinutes(bookingEnd.getMinutes() + bookingDuration);

        if (slotStart < bookingEnd && slotEnd > bookingStart) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        availableSlots.push(timeStr);
      }

      // Move to next slot (30 min intervals)
      currentMinute += 30;
      if (currentMinute >= 60) {
        currentHour += 1;
        currentMinute -= 60;
      }
    }

    results.push({
      date: dateStr,
      staffName: staffMember.name,
      staffId: staffMember.id,
      serviceName,
      serviceDuration,
      availableSlots,
    });
  }

  return results;
}

// ========================================
// GET SERVICES LIST
// ========================================

export async function getServicesList(businessId: string) {
  const services = await prisma.service.findMany({
    where: { businessId },
    select: { id: true, name: true, price: true, duration: true },
    orderBy: { name: "asc" },
  });
  return services;
}

// ========================================
// GET STAFF LIST
// ========================================

export async function getStaffList(businessId: string) {
  const staff = await prisma.staff.findMany({
    where: { businessId },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return staff;
}

// ========================================
// NOTIFY BUSINESS (via Telegram + Dashboard)
// ========================================

async function notifyBooking(
  businessId: string,
  type: "new_booking" | "cancellation",
  clientName: string,
  serviceName: string,
  staffName: string,
  date: string,
  time: string,
  bookingId: string,
  staffId?: string | null,
  clientPhone?: string | null
): Promise<void> {
  sendBookingNotification(businessId, type, {
    clientName,
    clientPhone,
    serviceName,
    staffName,
    date,
    time,
    bookingId,
    staffId,
  }).catch((err) => console.error("Notification error:", err));
}

// ========================================
// CREATE BOOKING
// ========================================

/**
 * Create a new booking
 */
export async function createBooking(
  businessId: string,
  dateStr: string, // "YYYY-MM-DD"
  time: string, // "HH:MM"
  clientName: string,
  clientTelegramId: bigint | null,
  serviceId?: string,
  staffId?: string,
  clientPhone?: string
): Promise<BookingResult> {
  try {
    // Get business timezone
    const businessInfo = await prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });
    const tz = businessInfo?.timezone ?? null;

    // Parse date and time (convert from business local time to UTC)
    const bookingDate = localToUTC(dateStr, time, tz);
    if (isNaN(bookingDate.getTime())) {
      return { success: false, error: "Некорректная дата или время" };
    }

    // Check if the date is in the past
    if (bookingDate < new Date()) {
      return { success: false, error: "Нельзя записаться на прошедшую дату" };
    }

    // Get service info
    let serviceName = "Услуга";
    let serviceDuration = 60;
    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { name: true, duration: true },
      });
      if (!service) {
        return { success: false, error: "Услуга не найдена" };
      }
      serviceName = service.name;
      serviceDuration = service.duration;
    }

    // Get staff info
    let staffName = "Любой мастер";
    const actualStaffId = staffId && staffId !== "__any__" ? staffId : undefined;
    if (actualStaffId) {
      const staff = await prisma.staff.findUnique({
        where: { id: actualStaffId },
        select: { name: true },
      });
      if (!staff) {
        return { success: false, error: "Мастер не найден" };
      }
      staffName = staff.name;
    }

    // Verify the slot and create booking atomically to prevent double-booking
    const slotEnd = new Date(bookingDate);
    slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);

    const txResult = await prisma.$transaction(async (tx) => {
      const dayBookings = await tx.booking.findMany({
        where: {
          businessId,
          status: { in: ["pending", "confirmed"] },
          date: {
            gte: localToUTC(dateStr, "00:00", tz),
            lte: localToUTC(dateStr, "23:59", tz),
          },
          ...(actualStaffId ? { staffId: actualStaffId } : {}),
        },
        include: {
          service: { select: { name: true, duration: true, price: true } },
          staff: { select: { name: true } },
        },
      });

      for (const existing of dayBookings) {
        const existingStart = new Date(existing.date);
        const existingDuration = existing.service?.duration || 60;
        const existingEnd = new Date(existingStart);
        existingEnd.setMinutes(existingEnd.getMinutes() + existingDuration);

        if (bookingDate < existingEnd && slotEnd > existingStart) {
          // If same client already booked this slot — return existing booking (idempotent)
          if (clientTelegramId && existing.clientTelegramId === clientTelegramId) {
            return {
              success: true as const,
              bookingId: existing.id,
              details: {
                date: dateStr,
                time,
                staffName: existing.staff?.name || staffName,
                serviceName: existing.service?.name || serviceName,
                clientName,
              },
            };
          }
          return { success: false as const, error: "Этот слот уже занят. Пожалуйста, выберите другое время." };
        }
      }

      // Create booking inside transaction
      const booking = await tx.booking.create({
        data: {
          clientName,
          clientPhone: clientPhone || null,
          clientTelegramId: clientTelegramId || undefined,
          date: bookingDate,
          status: "confirmed",
          businessId,
          serviceId: serviceId || null,
          staffId: actualStaffId || null,
        },
      });

      await tx.business.update({
        where: { id: businessId },
        data: { totalBookings: { increment: 1 } },
      });

      return { success: true as const, bookingId: booking.id, details: null };
    });

    if (!txResult.success) {
      return txResult;
    }
    if (txResult.details) {
      return txResult; // idempotent existing booking
    }

    const booking = { id: txResult.bookingId };

    // Update client record (only if we have a telegramId-compatible identifier)
    if (clientTelegramId) {
      await prisma.client.upsert({
        where: {
          businessId_telegramId: {
            businessId,
            telegramId: clientTelegramId,
          },
        },
        create: {
          businessId,
          telegramId: clientTelegramId,
          name: clientName,
          phone: clientPhone || null,
          lastVisitDate: bookingDate,
          totalVisits: 1,
        },
        update: {
          name: clientName || undefined,
          phone: clientPhone || undefined,
          lastVisitDate: bookingDate,
          totalVisits: { increment: 1 },
        },
      });
    }

    // Send notification to business owner and staff via Telegram + Dashboard (non-blocking)
    notifyBooking(businessId, "new_booking", clientName, serviceName, staffName, dateStr, time, booking.id, actualStaffId, clientPhone);

    return {
      success: true,
      bookingId: booking.id,
      details: {
        date: dateStr,
        time,
        staffName,
        serviceName,
        clientName,
      },
    };
  } catch (error) {
    console.error("Error creating booking:", error);
    return { success: false, error: "Ошибка при создании записи" };
  }
}

/**
 * Wrapper for channel-based bookings (Instagram, Facebook, WhatsApp).
 * Converts string clientId to BigInt for idempotency and client tracking.
 */
export async function createBookingFromChannel(
  businessId: string,
  dateStr: string,
  time: string,
  clientName: string,
  channelClientId: string,
  channel: string,
  serviceId?: string,
  staffId?: string,
  clientPhone?: string
): Promise<BookingResult> {
  const numericId = /^\d+$/.test(channelClientId) ? BigInt(channelClientId) : null;
  console.log(`[Booking] Creating booking from ${channel}, clientId=${channelClientId}, numericId=${numericId}`);
  return createBooking(businessId, dateStr, time, clientName, numericId, serviceId, staffId, clientPhone);
}

// ========================================
// GET CLIENT BOOKINGS
// ========================================

export async function getClientBookings(
  businessId: string,
  clientTelegramId: bigint
) {
  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      clientTelegramId,
      status: { in: ["pending", "confirmed"] },
      date: { gte: new Date() },
    },
    include: {
      service: { select: { name: true, price: true, duration: true } },
      staff: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  });

  return bookings.map((b) => ({
    id: b.id,
    date: b.date.toISOString(),
    serviceName: b.service?.name || "Услуга",
    servicePrice: b.service?.price || 0,
    staffName: b.staff?.name || "Любой мастер",
    status: b.status,
  }));
}

// ========================================
// CANCEL BOOKING
// ========================================

export async function cancelBooking(
  bookingId: string,
  clientTelegramId: bigint
): Promise<{ success: boolean; error?: string }> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { name: true } },
        staff: { select: { id: true, name: true } },
        business: { select: { timezone: true } },
      },
    });

    if (!booking) {
      return { success: false, error: "Запись не найдена" };
    }

    if (booking.clientTelegramId !== clientTelegramId) {
      return { success: false, error: "Вы не можете отменить чужую запись" };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
    });

    // Send cancellation notification using business timezone
    const bookingDate = new Date(booking.date);
    const tz = booking.business?.timezone || "Asia/Tashkent";
    const dateStr = bookingDate.toLocaleDateString("sv-SE", { timeZone: tz }); // YYYY-MM-DD
    const timeStr = bookingDate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz });
    notifyBooking(
      booking.businessId, "cancellation",
      booking.clientName, booking.service?.name || "Услуга",
      booking.staff?.name || "Любой мастер", dateStr, timeStr,
      bookingId, booking.staff?.id, booking.clientPhone
    );

    return { success: true };
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return { success: false, error: "Ошибка при отмене записи" };
  }
}

// ========================================
// TOOL DEFINITIONS FOR CLAUDE API
// ========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bookingToolDefinitions: any[] = [
  {
    name: "check_availability",
    description:
      "Проверить доступные слоты для записи на конкретную дату. Показывает свободное время для каждого мастера с учётом длительности услуги и существующих записей. ВСЕГДА вызывай этот инструмент когда клиент хочет записаться или спрашивает о свободном времени.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "Дата в формате YYYY-MM-DD. Например: 2026-02-07",
        },
        service_id: {
          type: "string",
          description:
            "ID услуги (из списка услуг). Если клиент не указал конкретную услугу, можно не передавать — будет использована стандартная длительность 60 мин.",
        },
        staff_id: {
          type: "string",
          description:
            "ID мастера. Если клиент не указал конкретного мастера, можно не передавать — покажет свободные слоты для всех мастеров.",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "create_booking",
    description:
      "Создать запись клиента на услугу. Вызывай ТОЛЬКО после того, как клиент подтвердил дату, время и услугу. Перед этим ОБЯЗАТЕЛЬНО проверь доступность через check_availability.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Дата в формате YYYY-MM-DD",
        },
        time: {
          type: "string",
          description: "Время в формате HH:MM. Например: 14:00",
        },
        client_name: {
          type: "string",
          description: "Имя клиента",
        },
        service_id: {
          type: "string",
          description: "ID услуги",
        },
        staff_id: {
          type: "string",
          description: "ID мастера. Если клиент не выбрал мастера — не передавай.",
        },
        client_phone: {
          type: "string",
          description: "Телефон клиента (если известен)",
        },
      },
      required: ["date", "time", "client_name"],
    },
  },
  {
    name: "get_services",
    description:
      "Получить полный список услуг с ценами, длительностью и ID. Вызывай когда нужно узнать ID услуги для записи или когда клиент спрашивает об услугах.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_staff",
    description:
      "Получить список мастеров/сотрудников с их ID и ролями. Вызывай когда нужно узнать ID мастера для записи.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_my_bookings",
    description:
      "Получить предстоящие записи текущего клиента. Вызывай когда клиент спрашивает о своих записях.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "cancel_booking",
    description:
      "Отменить запись клиента. Вызывай ТОЛЬКО когда клиент явно просит отменить запись.",
    input_schema: {
      type: "object" as const,
      properties: {
        booking_id: {
          type: "string",
          description: "ID записи для отмены",
        },
      },
      required: ["booking_id"],
    },
  },
  {
    name: "notify_manager",
    description:
      "Уведомить менеджера/владельца о вопросе клиента, который требует участия человека. Используй когда: клиент задаёт сложный вопрос за пределами твоей компетенции, нужно принять нестандартное решение, клиент явно просит поговорить с человеком, ситуация требует личного участия персонала. После вызова сообщи клиенту что передал вопрос менеджеру.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Имя клиента",
        },
        reason: {
          type: "string",
          description: "Краткое описание ситуации или вопроса клиента",
        },
        urgency: {
          type: "string",
          enum: ["normal", "urgent"],
          description: "Срочность: normal — обычный запрос, urgent — срочно",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "update_lead_status",
    description:
      "Обновить статус квалификации лида. Вызывай после каждого сообщения клиента, если его статус изменился. Не понижай статус — только повышай (cold → warm → hot → client).",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["cold", "warm", "hot", "client"],
          description:
            "cold: первое обращение, общий вопрос. warm: интерес к конкретной услуге, спрашивает цены. hot: хочет записаться, обсуждает время. client: записался или купил.",
        },
        reason: {
          type: "string",
          description: "Почему статус изменён (кратко)",
        },
      },
      required: ["status"],
    },
  },
];

// ========================================
// LEAD QUALIFICATION
// ========================================

const STATUS_ORDER: Record<string, number> = { cold: 0, warm: 1, hot: 2, client: 3 };

/**
 * Update lead qualification status. Only upgrades (never downgrades).
 */
export async function updateLeadStatus(
  businessId: string,
  clientId: string,
  channel: string,
  status: string,
  reason?: string,
  clientName?: string
): Promise<{ success: boolean; previousStatus?: string; newStatus: string }> {
  try {
    // Find existing lead
    const existing = await prisma.lead.findFirst({
      where: { businessId, channel, clientId },
    });

    const prevStatus = existing?.status || "cold";
    const prevOrder = STATUS_ORDER[prevStatus] ?? 0;
    const newOrder = STATUS_ORDER[status] ?? 0;

    // Don't downgrade
    const finalStatus = newOrder >= prevOrder ? status : prevStatus;

    const now = new Date();
    const isQualified = finalStatus === "hot" || finalStatus === "client";

    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          status: finalStatus,
          statusReason: reason,
          lastInteractionAt: now,
          ...(isQualified && !existing.qualifiedAt ? { qualifiedAt: now } : {}),
          ...(finalStatus === "client" && !existing.convertedAt ? { convertedAt: now } : {}),
          ...(clientName ? { clientName } : {}),
        },
      });
    } else {
      await prisma.lead.create({
        data: {
          businessId,
          channel,
          clientId,
          clientName,
          source: "channel_message",
          status: finalStatus,
          statusReason: reason,
          lastInteractionAt: now,
          ...(isQualified ? { qualifiedAt: now } : {}),
          ...(finalStatus === "client" ? { convertedAt: now } : {}),
        },
      });
    }

    return { success: true, previousStatus: prevStatus, newStatus: finalStatus };
  } catch (error) {
    console.error("[Lead] Error updating status:", error);
    return { success: false, newStatus: status };
  }
}

