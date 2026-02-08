import { prisma } from "@/lib/prisma";
import { sendSubscriptionReminder } from "@/lib/email";

// ===========================================
// TIMEZONE HELPERS
// ===========================================

// UTC offset in minutes for IANA timezone names
// Covering CIS, Korea, and major world timezones
const TIMEZONE_OFFSETS: Record<string, number> = {
  // CIS & Central Asia
  "Asia/Tashkent": 300,      // UTC+5 Узбекистан
  "Asia/Almaty": 300,        // UTC+5 Казахстан (с 2024 — единый UTC+5)
  "Asia/Bishkek": 360,       // UTC+6 Кыргызстан
  "Asia/Dushanbe": 300,      // UTC+5 Таджикистан
  "Asia/Ashgabat": 300,      // UTC+5 Туркменистан
  "Asia/Baku": 240,          // UTC+4 Азербайджан
  "Asia/Yerevan": 240,       // UTC+4 Армения
  "Asia/Tbilisi": 240,       // UTC+4 Грузия

  // Россия (11 зон)
  "Europe/Kaliningrad": 120, // UTC+2
  "Europe/Moscow": 180,      // UTC+3
  "Europe/Samara": 240,      // UTC+4
  "Asia/Yekaterinburg": 300, // UTC+5
  "Asia/Omsk": 360,          // UTC+6
  "Asia/Novosibirsk": 420,   // UTC+7
  "Asia/Krasnoyarsk": 420,   // UTC+7
  "Asia/Irkutsk": 480,       // UTC+8
  "Asia/Yakutsk": 540,       // UTC+9
  "Asia/Vladivostok": 600,   // UTC+10
  "Asia/Kamchatka": 720,     // UTC+12

  // Корея, Япония, Китай
  "Asia/Seoul": 540,         // UTC+9
  "Asia/Tokyo": 540,         // UTC+9
  "Asia/Shanghai": 480,      // UTC+8

  // Ближний Восток
  "Asia/Dubai": 240,         // UTC+4
  "Asia/Riyadh": 180,        // UTC+3
  "Asia/Istanbul": 180,      // UTC+3

  // Европа
  "Europe/London": 0,        // UTC+0
  "Europe/Berlin": 60,       // UTC+1
  "Europe/Paris": 60,        // UTC+1
  "Europe/Kiev": 120,        // UTC+2

  // Америка
  "America/New_York": -300,  // UTC-5
  "America/Chicago": -360,   // UTC-6
  "America/Denver": -420,    // UTC-7
  "America/Los_Angeles": -480, // UTC-8
};

// Default timezone for country (used when business has no timezone set)
const COUNTRY_DEFAULT_TZ: Record<string, string> = {
  UZ: "Asia/Tashkent",
  KZ: "Asia/Almaty",
  KR: "Asia/Seoul",
  RU: "Europe/Moscow",
  KG: "Asia/Bishkek",
  TJ: "Asia/Dushanbe",
  TM: "Asia/Ashgabat",
  AZ: "Asia/Baku",
  AM: "Asia/Yerevan",
  GE: "Asia/Tbilisi",
  TR: "Asia/Istanbul",
  AE: "Asia/Dubai",
  US: "America/New_York",
  GB: "Europe/London",
  DE: "Europe/Berlin",
  UA: "Europe/Kiev",
  CN: "Asia/Shanghai",
  JP: "Asia/Tokyo",
};

// List of all timezones for UI selector
export const TIMEZONES = Object.entries(TIMEZONE_OFFSETS).map(([tz, offset]) => {
  const sign = offset >= 0 ? "+" : "-";
  const h = Math.floor(Math.abs(offset) / 60);
  const m = Math.abs(offset) % 60;
  const label = `UTC${sign}${h}${m ? `:${m.toString().padStart(2, "0")}` : ""} — ${tz.split("/")[1]?.replace(/_/g, " ") || tz}`;
  return { value: tz, label, offset };
}).sort((a, b) => a.offset - b.offset);

// Get default timezone for a country
export function getDefaultTimezone(country: string | null): string {
  return COUNTRY_DEFAULT_TZ[country || "UZ"] || "Asia/Tashkent";
}

// Get timezone offset in minutes from IANA timezone name
export function getTimezoneOffset(timezone: string | null): number {
  return TIMEZONE_OFFSETS[timezone || "Asia/Tashkent"] ?? 300;
}

// Convert UTC date to local time for display
export function toLocalTime(utcDate: Date, timezone: string | null): Date {
  const offsetMs = getTimezoneOffset(timezone) * 60 * 1000;
  return new Date(utcDate.getTime() + offsetMs);
}

// Convert local time string to UTC Date for storage
// e.g., "2025-02-07" + "17:00" in Asia/Tashkent → UTC Date
export function localToUTC(dateStr: string, time: string, timezone: string | null): Date {
  const offsetMinutes = getTimezoneOffset(timezone);
  const utcDate = new Date(`${dateStr}T${time}:00Z`);
  utcDate.setMinutes(utcDate.getMinutes() - offsetMinutes);
  return utcDate;
}

// Отправить сообщение клиенту через бота бизнеса
export async function sendAutomationMessage(
  botToken: string,
  chatId: bigint,
  message: string,
  buttons?: { text: string; callback_data: string }[][]
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const body: Record<string, unknown> = {
      chat_id: chatId.toString(),
      text: message,
      parse_mode: "HTML",
    };

    if (buttons && buttons.length > 0) {
      body.reply_markup = {
        inline_keyboard: buttons,
      };
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Telegram automation message error:", errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    console.error("Telegram automation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Форматировать дату на русском (конвертирует UTC → локальное время бизнеса)
export function formatDateRu(date: Date, country?: string | null): string {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const local = toLocalTime(date, country ?? null);
  const day = local.getUTCDate();
  const month = months[local.getUTCMonth()];
  const hours = local.getUTCHours().toString().padStart(2, "0");
  const minutes = local.getUTCMinutes().toString().padStart(2, "0");
  return `${day} ${month} в ${hours}:${minutes}`;
}

// Генерация промокода
export function generatePromoCode(prefix: string, discount: number): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${discount}${random}`;
}

// ===========================================
// НАПОМИНАНИЯ О ЗАПИСИ
// ===========================================

export async function processReminders() {
  const now = new Date();
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  // Получаем все бизнесы с активными настройками
  const businesses = await prisma.business.findMany({
    where: {
      botToken: { not: null },
      botActive: true,
      automationSettings: {
        OR: [
          { reminder24hEnabled: true },
          { reminder2hEnabled: true },
        ],
      },
    },
    include: {
      automationSettings: true,
      bookings: {
        where: {
          status: { in: ["pending", "confirmed"] },
          clientTelegramId: { not: null },
          date: { gte: now },
        },
        include: {
          service: true,
        },
      },
    },
  });

  for (const business of businesses) {
    if (!business.botToken || !business.automationSettings) continue;

    const settings = business.automationSettings;

    for (const booking of business.bookings) {
      if (!booking.clientTelegramId) continue;

      const hoursUntil = (booking.date.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Напоминание за 24 часа
      if (
        settings.reminder24hEnabled &&
        !booking.reminder24hSent &&
        hoursUntil <= 24 &&
        hoursUntil > 23
      ) {
        const message = `Здравствуйте, ${booking.clientName}! 👋

Напоминаем о вашей записи:
📅 Завтра, ${formatDateRu(booking.date, business.timezone)}
${booking.service ? `💇 ${booking.service.name}` : ""}
${business.address ? `📍 ${business.address}` : ""}

Ждём вас! 💜`;

        const result = await sendAutomationMessage(
          business.botToken,
          booking.clientTelegramId,
          message,
          [
            [
              { text: "✅ Подтверждаю", callback_data: `confirm_${booking.id}` },
              { text: "📅 Перенести", callback_data: `reschedule_${booking.id}` },
            ],
            [
              { text: "❌ Отменить", callback_data: `cancel_${booking.id}` },
            ],
          ]
        );

        if (result.success) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { reminder24hSent: true },
          });
          // Track in ScheduledReminder for stats
          await prisma.scheduledReminder.create({
            data: {
              type: "reminder_24h",
              status: "sent",
              scheduledFor: now,
              sentAt: now,
              clientTelegramId: booking.clientTelegramId,
              clientName: booking.clientName,
              serviceName: booking.service?.name,
              appointmentDate: booking.date,
              bookingId: booking.id,
              businessId: business.id,
            },
          });
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`24h reminder for booking ${booking.id}: ${result.error}`);
        }
      }

      // Напоминание за 2 часа
      if (
        settings.reminder2hEnabled &&
        !booking.reminder2hSent &&
        hoursUntil <= 2 &&
        hoursUntil > 1.5
      ) {
        const message = `До вашего визита осталось 2 часа! ⏰

📅 Сегодня, ${formatDateRu(booking.date, business.timezone)}
${booking.service ? `💇 ${booking.service.name}` : ""}
${business.address ? `📍 ${business.address}` : ""}

Ждём вас! 💜`;

        const result = await sendAutomationMessage(
          business.botToken,
          booking.clientTelegramId,
          message
        );

        if (result.success) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { reminder2hSent: true },
          });
          // Track in ScheduledReminder for stats
          await prisma.scheduledReminder.create({
            data: {
              type: "reminder_2h",
              status: "sent",
              scheduledFor: now,
              sentAt: now,
              clientTelegramId: booking.clientTelegramId,
              clientName: booking.clientName,
              serviceName: booking.service?.name,
              appointmentDate: booking.date,
              bookingId: booking.id,
              businessId: business.id,
            },
          });
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`2h reminder for booking ${booking.id}: ${result.error}`);
        }
      }
    }
  }

  return results;
}

// ===========================================
// СБОР ОТЗЫВОВ
// ===========================================

export async function processReviewRequests() {
  const now = new Date();
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  // Получаем все бизнесы с включенным сбором отзывов
  const businesses = await prisma.business.findMany({
    where: {
      botToken: { not: null },
      botActive: true,
      automationSettings: {
        reviewEnabled: true,
      },
    },
    include: {
      automationSettings: true,
      bookings: {
        where: {
          status: "completed",
          clientTelegramId: { not: null },
          reviewRequested: false,
        },
        include: {
          service: true,
        },
      },
    },
  });

  for (const business of businesses) {
    if (!business.botToken || !business.automationSettings) continue;

    const settings = business.automationSettings;
    const delayMs = settings.reviewDelayHours * 60 * 60 * 1000;

    for (const booking of business.bookings) {
      if (!booking.clientTelegramId) continue;

      // Проверяем, прошло ли достаточно времени после записи
      const timeSinceBooking = now.getTime() - booking.date.getTime();
      if (timeSinceBooking < delayMs) continue;

      const message = `Здравствуйте, ${booking.clientName}! 💜

Спасибо, что были у нас${booking.service ? ` на услуге "${booking.service.name}"` : ""}!

Как вам визит? Оцените, пожалуйста:`;

      const result = await sendAutomationMessage(
        business.botToken,
        booking.clientTelegramId,
        message,
        [
          [
            { text: "⭐", callback_data: `rate_${booking.id}_1` },
            { text: "⭐⭐", callback_data: `rate_${booking.id}_2` },
            { text: "⭐⭐⭐", callback_data: `rate_${booking.id}_3` },
          ],
          [
            { text: "⭐⭐⭐⭐", callback_data: `rate_${booking.id}_4` },
            { text: "⭐⭐⭐⭐⭐", callback_data: `rate_${booking.id}_5` },
          ],
        ]
      );

      if (result.success) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { reviewRequested: true },
        });
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`Review request for booking ${booking.id}: ${result.error}`);
      }
    }
  }

  return results;
}

// ===========================================
// РЕАКТИВАЦИЯ КЛИЕНТОВ
// ===========================================

export async function processReactivation() {
  const now = new Date();
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  // Получаем все бизнесы с включенной реактивацией
  const businesses = await prisma.business.findMany({
    where: {
      botToken: { not: null },
      botActive: true,
      automationSettings: {
        reactivationEnabled: true,
      },
    },
    include: {
      automationSettings: true,
      clients: {
        where: {
          isBlocked: false,
          lastVisitDate: { not: null },
        },
      },
    },
  });

  for (const business of businesses) {
    if (!business.botToken || !business.automationSettings) continue;

    const settings = business.automationSettings;
    const reactivationThreshold = new Date(
      now.getTime() - settings.reactivationDays * 24 * 60 * 60 * 1000
    );
    const reactivationCooldown = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000 // Не отправлять чаще раза в месяц
    );

    for (const client of business.clients) {
      if (!client.lastVisitDate) continue;

      // Проверяем, прошло ли достаточно времени с последнего визита
      if (client.lastVisitDate > reactivationThreshold) continue;

      // Проверяем, не отправляли ли недавно
      if (client.lastReactivationSent && client.lastReactivationSent > reactivationCooldown) {
        continue;
      }

      const promoCode = generatePromoCode("WELCOME", settings.reactivationDiscount);
      const daysSinceVisit = Math.floor(
        (now.getTime() - client.lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let message: string;
      if (daysSinceVisit > 90) {
        // Последняя попытка
        message = `Привет${client.name ? `, ${client.name}` : ""}!

Мы не хотим вас терять 😢
Специально для вас — скидка ${settings.reactivationDiscount}%!

🎁 Промокод: <b>${promoCode}</b>
⏰ Это последнее предложение.

Назовите промокод при записи!`;
      } else if (daysSinceVisit > 60) {
        // С мотивацией
        message = `Привет${client.name ? `, ${client.name}` : ""}!

Мы скучаем! 💜
Вот вам скидка ${settings.reactivationDiscount}% на следующий визит.

🎁 Промокод: <b>${promoCode}</b>
⏰ Действует 7 дней

Ждём вас снова!`;
      } else {
        // Мягкое напоминание
        message = `Привет${client.name ? `, ${client.name}` : ""}! 👋

Давно вас не видели!
Последний раз вы были у нас ${daysSinceVisit} дней назад.

Может, пора обновиться? 💇

Ждём вас!`;
      }

      const buttons = daysSinceVisit > 60
        ? [
            [{ text: "📅 Записаться со скидкой", callback_data: `book_promo_${promoCode}` }],
            [{ text: "🚫 Отписаться", callback_data: `unsubscribe_${client.id}` }],
          ]
        : [
            [{ text: "📅 Записаться", callback_data: "book_new" }],
          ];

      const result = await sendAutomationMessage(
        business.botToken,
        client.telegramId,
        message,
        buttons
      );

      if (result.success) {
        await prisma.client.update({
          where: { id: client.id },
          data: { lastReactivationSent: now },
        });

        // Записываем в историю напоминаний
        await prisma.scheduledReminder.create({
          data: {
            type: "reactivation",
            status: "sent",
            scheduledFor: now,
            sentAt: now,
            clientTelegramId: client.telegramId,
            clientName: client.name,
            lastVisitDate: client.lastVisitDate,
            discountCode: daysSinceVisit > 60 ? promoCode : null,
            businessId: business.id,
          },
        });

        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`Reactivation for client ${client.id}: ${result.error}`);
      }
    }
  }

  return results;
}

// ===========================================
// НАПОМИНАНИЯ ОБ ОКОНЧАНИИ ПОДПИСКИ
// ===========================================

export async function processSubscriptionReminders() {
  const now = new Date();
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  // Find all active subscriptions that are expiring within 7 days
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
      expiresAt: { lte: sevenDaysFromNow, gt: now },
    },
    include: {
      business: {
        include: {
          user: { select: { email: true, name: true, notifyTrialEnding: true } },
        },
      },
    },
  });

  for (const sub of subscriptions) {
    const user = sub.business?.user;
    if (!user?.email || !user.notifyTrialEnding) continue;

    const msLeft = sub.expiresAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) continue;

    const planName = sub.plan === "trial" ? "Пробный период"
      : sub.plan === "starter" ? "Starter"
      : sub.plan === "pro" ? "Pro"
      : sub.plan === "business" ? "Business"
      : sub.plan === "enterprise" ? "Enterprise"
      : sub.plan;

    // 7-day reminder (days 4-7)
    if (daysLeft <= 7 && daysLeft > 3 && !sub.reminder7dSent) {
      const result = await sendSubscriptionReminder(user.email, user.name, planName, daysLeft);
      if (result.success) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { reminder7dSent: true },
        });
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`7d reminder for ${user.email}: ${result.error}`);
      }
    }

    // 3-day reminder (days 2-3)
    if (daysLeft <= 3 && daysLeft > 1 && !sub.reminder3dSent) {
      const result = await sendSubscriptionReminder(user.email, user.name, planName, daysLeft);
      if (result.success) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { reminder3dSent: true },
        });
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`3d reminder for ${user.email}: ${result.error}`);
      }
    }

    // Last day reminder
    if (daysLeft <= 1 && !sub.reminder1dSent) {
      const result = await sendSubscriptionReminder(user.email, user.name, planName, daysLeft);
      if (result.success) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { reminder1dSent: true },
        });
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`1d reminder for ${user.email}: ${result.error}`);
      }
    }
  }

  return results;
}
