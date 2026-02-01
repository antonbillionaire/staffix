import { prisma } from "@/lib/prisma";

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

// Форматировать дату на русском
export function formatDateRu(date: Date): string {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
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
📅 Завтра, ${formatDateRu(booking.date)}
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

📅 Сегодня, ${formatDateRu(booking.date)}
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
