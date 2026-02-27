/**
 * Notification System for Staffix
 * Multi-channel: Telegram, WhatsApp, in-app dashboard notifications.
 * FB Messenger / Instagram DM notifications require owner PSID (future).
 */

import { prisma } from "./prisma";
import { sendWAMessage } from "./whatsapp-utils";
import { sendFBMessage } from "./facebook-utils";

// ========================================
// TELEGRAM HELPER
// ========================================

export async function sendTelegramMsg(
  botToken: string,
  chatId: bigint | number,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.toString(),
          text,
          parse_mode: "HTML",
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    return false;
  }
}

// ========================================
// MULTI-CHANNEL OWNER NOTIFICATION
// ========================================

/**
 * Send notification to business owner via ALL available channels.
 * Currently: Telegram + WhatsApp (if connected) + in-app.
 * Future: FB Messenger, Instagram DM (need owner PSID/IG ID).
 */
export async function sendOwnerNotification(
  businessId: string,
  text: string,
  plainText?: string
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        botToken: true,
        ownerTelegramChatId: true,
        phone: true,
        waPhoneNumberId: true,
        waAccessToken: true,
        waActive: true,
        fbPageAccessToken: true,
        fbActive: true,
      },
    });
    if (!business) return;

    // Plain text version (strip HTML tags for non-Telegram channels)
    const plain = plainText || text.replace(/<[^>]+>/g, "");

    // 1. Telegram (primary)
    if (business.botToken && business.ownerTelegramChatId) {
      sendTelegramMsg(business.botToken, business.ownerTelegramChatId, text).catch(
        (err) => console.error("Owner notify TG error:", err)
      );
    }

    // 2. WhatsApp (if connected and owner phone is available)
    if (business.waActive && business.waPhoneNumberId && business.waAccessToken && business.phone) {
      // Normalize phone: remove spaces, dashes, ensure starts with country code
      const ownerPhone = business.phone.replace(/[\s\-()]/g, "");
      if (ownerPhone.length >= 10) {
        sendWAMessage(business.waPhoneNumberId, business.waAccessToken, ownerPhone, plain).catch(
          (err) => console.error("Owner notify WA error:", err)
        );
      }
    }

    // 3. FB Messenger — requires owner's PSID (not stored yet)
    // Future: if (business.fbActive && business.ownerFbPsid) { sendFBMessage(...) }

  } catch (error) {
    console.error("sendOwnerNotification error:", error);
  }
}

// ========================================
// BOOKING NOTIFICATION
// ========================================

interface BookingNotificationData {
  clientName: string;
  clientPhone?: string | null;
  serviceName: string;
  staffName: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  bookingId: string;
  staffId?: string | null;
}

export async function sendBookingNotification(
  businessId: string,
  type: "new_booking" | "cancellation" | "reschedule",
  data: BookingNotificationData
): Promise<void> {
  try {
    // Load business with owner info
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        botToken: true,
        ownerTelegramChatId: true,
        name: true,
        phone: true,
        waPhoneNumberId: true,
        waAccessToken: true,
        waActive: true,
        userId: true,
        user: {
          select: {
            notifyNewBookings: true,
            notifyCancellations: true,
          },
        },
      },
    });

    if (!business) return;

    // Build notification title and message
    const { title, ownerMsg, staffMsg } = formatNotificationMessages(type, data);

    // 1. Create in-app notification (for dashboard bell)
    await prisma.notification.create({
      data: {
        type,
        title,
        message: ownerMsg,
        metadata: {
          bookingId: data.bookingId,
          clientName: data.clientName,
          staffName: data.staffName,
          serviceName: data.serviceName,
          date: data.date,
          time: data.time,
        },
        businessId,
      },
    });

    // Check user notification preferences
    const shouldNotify =
      (type === "new_booking" && business.user.notifyNewBookings) ||
      (type === "cancellation" && business.user.notifyCancellations) ||
      type === "reschedule";

    if (!shouldNotify || !business.botToken) return;

    // 2. Send Telegram to owner
    if (business.ownerTelegramChatId) {
      sendTelegramMsg(business.botToken, business.ownerTelegramChatId, ownerMsg).catch(
        (err) => console.error("Failed to notify owner via TG:", err)
      );
    }

    // 2b. Send WhatsApp to owner (if WA connected and phone available)
    if (business.waActive && business.waPhoneNumberId && business.waAccessToken && business.phone) {
      const ownerPhone = business.phone.replace(/[\s\-()]/g, "");
      if (ownerPhone.length >= 10) {
        const plainMsg = ownerMsg.replace(/<[^>]+>/g, "");
        sendWAMessage(business.waPhoneNumberId, business.waAccessToken, ownerPhone, plainMsg).catch(
          (err) => console.error("Failed to notify owner via WA:", err)
        );
      }
    }

    // 3. Send Telegram to assigned staff (master)
    if (data.staffId) {
      const staff = await prisma.staff.findUnique({
        where: { id: data.staffId },
        select: { telegramChatId: true, notificationsEnabled: true },
      });

      if (staff?.telegramChatId && staff.notificationsEnabled) {
        sendTelegramMsg(business.botToken, staff.telegramChatId, staffMsg).catch(
          (err) => console.error("Failed to notify staff:", err)
        );
      }
    }

    // 4. Also notify admin/manager staff about all bookings
    const adminStaff = await prisma.staff.findMany({
      where: {
        businessId,
        telegramChatId: { not: null },
        notificationsEnabled: true,
        role: { in: ["admin", "manager"] },
        ...(data.staffId ? { id: { not: data.staffId } } : {}),
      },
      select: { telegramChatId: true },
    });

    for (const admin of adminStaff) {
      if (admin.telegramChatId) {
        sendTelegramMsg(business.botToken, admin.telegramChatId, ownerMsg).catch(
          (err) => console.error("Failed to notify admin staff:", err)
        );
      }
    }
  } catch (error) {
    console.error("Error sending booking notification:", error);
  }
}

// ========================================
// FORMAT MESSAGES
// ========================================

function formatNotificationMessages(
  type: "new_booking" | "cancellation" | "reschedule",
  data: BookingNotificationData
): { title: string; ownerMsg: string; staffMsg: string } {
  const dateFormatted = formatDateShort(data.date, data.time);

  if (type === "new_booking") {
    const title = "Новая запись";
    const ownerMsg = [
      "📅 <b>Новая запись!</b>",
      "",
      `Клиент: ${data.clientName}${data.clientPhone ? ` (${data.clientPhone})` : ""}`,
      `Услуга: ${data.serviceName}`,
      `Мастер: ${data.staffName}`,
      `Дата: ${dateFormatted}`,
    ].join("\n");

    const staffMsg = [
      "📅 <b>К вам новая запись!</b>",
      "",
      `Клиент: ${data.clientName}`,
      `Услуга: ${data.serviceName}`,
      `Дата: ${dateFormatted}`,
    ].join("\n");

    return { title, ownerMsg, staffMsg };
  }

  if (type === "cancellation") {
    const title = "Отмена записи";
    const ownerMsg = [
      "❌ <b>Запись отменена</b>",
      "",
      `Клиент: ${data.clientName}`,
      `Услуга: ${data.serviceName}`,
      `Мастер: ${data.staffName}`,
      `Дата: ${dateFormatted}`,
    ].join("\n");

    const staffMsg = [
      "❌ <b>Запись отменена</b>",
      "",
      `Клиент: ${data.clientName}`,
      `Услуга: ${data.serviceName}`,
      `Дата: ${dateFormatted}`,
    ].join("\n");

    return { title, ownerMsg, staffMsg };
  }

  // reschedule
  const title = "Перенос записи";
  const ownerMsg = [
    "🔄 <b>Запись перенесена</b>",
    "",
    `Клиент: ${data.clientName}`,
    `Услуга: ${data.serviceName}`,
    `Мастер: ${data.staffName}`,
    `Новая дата: ${dateFormatted}`,
  ].join("\n");

  const staffMsg = [
    "🔄 <b>Запись перенесена</b>",
    "",
    `Клиент: ${data.clientName}`,
    `Услуга: ${data.serviceName}`,
    `Новая дата: ${dateFormatted}`,
  ].join("\n");

  return { title, ownerMsg, staffMsg };
}

function formatDateShort(dateStr: string, time: string): string {
  const months = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day} ${months[month - 1]}, ${time}`;
}
