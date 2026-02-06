/**
 * Booking Tools for AI Bot
 * Functions that Claude can call via tool_use to check availability and create bookings
 */

import { prisma } from "./prisma";

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
function parseWorkingHours(
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
    select: { workingHours: true },
  });

  // Parse the target date
  const targetDate = new Date(dateStr + "T00:00:00");
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

  // Load staff members
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

  // Get all bookings for this date
  const dayStart = new Date(dateStr + "T00:00:00");
  const dayEnd = new Date(dateStr + "T23:59:59");

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
    // Filter bookings for this staff member
    const staffBookings = staffMember.id === "__any__"
      ? existingBookings
      : existingBookings.filter((b) => b.staffId === staffMember.id || b.staffId === null);

    // Generate time slots
    const availableSlots: string[] = [];

    // Iterate through the day in 30-min increments
    let currentHour = hours.startHour;
    let currentMinute = hours.startMinute;

    while (
      currentHour < hours.endHour ||
      (currentHour === hours.endHour && currentMinute < hours.endMinute)
    ) {
      const slotStart = new Date(targetDate);
      slotStart.setHours(currentHour, currentMinute, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);

      // Check if slot end exceeds working hours
      const workEnd = new Date(targetDate);
      workEnd.setHours(hours.endHour, hours.endMinute, 0, 0);

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

        // Check overlap: slot overlaps booking if slotStart < bookingEnd AND slotEnd > bookingStart
        if (slotStart < bookingEnd && slotEnd > bookingStart) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        const timeStr = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
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
// NOTIFY BUSINESS OWNER
// ========================================

async function notifyBusinessOwner(
  businessId: string,
  clientName: string,
  serviceName: string,
  staffName: string,
  date: string,
  time: string
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { botToken: true, userId: true, user: { select: { email: true } } },
  });

  if (!business?.botToken) return;

  // Find owner's Telegram chat ID from conversations (owner might have messaged the bot)
  // For now, we use the business owner's user record
  // The notification is sent to the bot's own chat - the owner sees it in the bot's admin
  // Alternative: send to a specific admin chat ID stored in business settings

  // Log the booking for dashboard visibility
  console.log(`[Booking Notification] New booking: ${clientName} -> ${serviceName} with ${staffName} on ${date} at ${time}`);
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
  clientTelegramId: bigint,
  serviceId?: string,
  staffId?: string,
  clientPhone?: string
): Promise<BookingResult> {
  try {
    // Parse date and time
    const bookingDate = new Date(`${dateStr}T${time}:00`);
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

    // Verify the slot is still available
    const slotEnd = new Date(bookingDate);
    slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);

    const dayBookings = await prisma.booking.findMany({
      where: {
        businessId,
        status: { in: ["pending", "confirmed"] },
        date: { gte: new Date(`${dateStr}T00:00:00`), lte: new Date(`${dateStr}T23:59:59`) },
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
        if (existing.clientTelegramId === clientTelegramId) {
          return {
            success: true,
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
        return { success: false, error: "Этот слот уже занят. Пожалуйста, выберите другое время." };
      }
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        clientName,
        clientPhone: clientPhone || null,
        clientTelegramId,
        date: bookingDate,
        status: "confirmed",
        businessId,
        serviceId: serviceId || null,
        staffId: actualStaffId || null,
      },
    });

    // Update business stats
    await prisma.business.update({
      where: { id: businessId },
      data: { totalBookings: { increment: 1 } },
    });

    // Update client record: mark as active with visit
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

    // Send notification to business owner via Telegram (non-blocking)
    notifyBusinessOwner(businessId, clientName, serviceName, staffName, dateStr, time).catch(
      (err: unknown) => console.error("Failed to notify owner:", err)
    );

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
];

