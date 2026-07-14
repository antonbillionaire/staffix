/**
 * Обработка нажатий на inline-кнопки Telegram (callback_query).
 *
 * Поддерживаемые префиксы:
 *  - confirm_<bookingId>     — клиент подтвердил запись
 *  - cancel_<bookingId>      — клиент отменил запись
 *  - reschedule_<bookingId>  — клиент хочет перенести (отменяем и просим новую дату)
 *  - rate_<bookingId>_<1-5>  — оценка после визита, далее ждём текстовый коммент
 *  - order_packed_<orderId>  — складской отметил «собрано», уведомляем менеджера и клиента
 *  - unsubscribe_<clientId>  — отписка от рассылок (Client.isBlocked=true)
 *  - book_new / book_promo_* — кнопка из реактивации/промо, просим дату/время
 *  - set_lang:<ru|en|uz|kz>  — выбор языка из /lang
 */

import { prisma } from "@/lib/prisma";
import { cancelBooking } from "@/lib/booking-tools";
import { sendBookingNotification, notifyManagerOrderPacked } from "@/lib/notifications";
import { formatDateRu } from "@/lib/automation";
import {
  TelegramUpdate,
  sendTelegramMessage,
  answerCallbackQuery,
  editMessageText,
} from "./api";

export async function handleCallbackQuery(
  botToken: string,
  businessId: string,
  callbackQuery: NonNullable<TelegramUpdate["callback_query"]>
): Promise<void> {
  const data = callbackQuery.data || "";
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const telegramId = BigInt(callbackQuery.from.id);

  if (!chatId) return;

  // ---- CONFIRM BOOKING ----
  if (data.startsWith("confirm_")) {
    const bookingId = data.replace("confirm_", "");

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "confirmed" },
    });

    await answerCallbackQuery(botToken, callbackQuery.id, "Запись подтверждена!");

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        staff: { select: { id: true, name: true } },
        business: { select: { timezone: true, address: true } },
      },
    });

    if (booking && messageId) {
      await editMessageText(
        botToken,
        chatId,
        messageId,
        `✅ Запись подтверждена!\n\n📅 ${formatDateRu(booking.date, booking.business?.timezone)}\n${booking.service ? `💇 ${booking.service.name}` : ""}${booking.business?.address ? `\n📍 ${booking.business.address}` : ""}\n\nЖдём вас! 💜`
      );

      // Notify owner and staff about confirmation
      const bookingDate = new Date(booking.date);
      const dateStr = bookingDate.toISOString().split("T")[0];
      const timeStr = bookingDate.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
      sendBookingNotification(businessId, "new_booking", {
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        serviceName: booking.service?.name || "Услуга",
        staffName: booking.staff?.name || "Любой мастер",
        date: dateStr,
        time: timeStr,
        bookingId,
        staffId: booking.staff?.id,
      }).catch((err) => console.error("Confirm notification error:", err));
    }
    return;
  }

  // ---- CANCEL BOOKING ----
  if (data.startsWith("cancel_")) {
    const bookingId = data.replace("cancel_", "");

    const result = await cancelBooking(bookingId, telegramId);

    if (result.success) {
      await answerCallbackQuery(botToken, callbackQuery.id, "Запись отменена");
      if (messageId) {
        await editMessageText(
          botToken,
          chatId,
          messageId,
          "❌ Запись отменена.\n\nЕсли хотите записаться снова — просто напишите!"
        );
      }
    } else {
      await answerCallbackQuery(botToken, callbackQuery.id, result.error || "Ошибка отмены");
    }
    return;
  }

  // ---- RESCHEDULE BOOKING ----
  if (data.startsWith("reschedule_")) {
    const bookingId = data.replace("reschedule_", "");

    await cancelBooking(bookingId, telegramId);

    await answerCallbackQuery(botToken, callbackQuery.id, "Запись отменена для переноса");

    if (messageId) {
      await editMessageText(
        botToken,
        chatId,
        messageId,
        "📅 Предыдущая запись отменена.\n\nНапишите мне новую дату и время, и я запишу вас заново!"
      );
    }
    return;
  }

  // ---- RATE BOOKING ----
  if (data.startsWith("rate_")) {
    const parts = data.split("_"); // rate_bookingId_rating
    const bookingId = parts[1];
    const rating = parseInt(parts[2]);

    if (rating >= 1 && rating <= 5) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (booking) {
        // Save review draft (without comment yet)
        await prisma.review.create({
          data: {
            rating,
            clientTelegramId: telegramId,
            clientName: booking.clientName,
            bookingId: booking.id,
            businessId,
          },
        });
      }

      const stars = "⭐".repeat(rating);
      await answerCallbackQuery(botToken, callbackQuery.id, `Спасибо за оценку: ${stars}`);

      if (messageId) {
        // Always ask for a text comment regardless of rating
        const prompt =
          rating >= 4
            ? `Спасибо за оценку ${stars}! Мы очень рады! 💜\n\nРасскажите подробнее — что понравилось больше всего? Ваш отзыв поможет нам стать ещё лучше:`
            : `Спасибо за оценку ${stars}.\n\nНам очень важно понять, что пошло не так. Пожалуйста, расскажите подробнее:`;
        await editMessageText(botToken, chatId, messageId, prompt);
      }
    }
    return;
  }

  // ---- ORDER PACKED (warehouse staff presses "Собрано") ----
  if (data.startsWith("order_packed_")) {
    const orderId = data.replace("order_packed_", "");

    const order = await prisma.order.findFirst({
      where: { id: orderId, businessId },
    });

    if (!order) {
      await answerCallbackQuery(botToken, callbackQuery.id, "Заказ не найден");
      return;
    }

    if (order.status !== "confirmed") {
      await answerCallbackQuery(botToken, callbackQuery.id, `Заказ уже в статусе: ${order.status}`);
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "processing" },
    });

    await answerCallbackQuery(botToken, callbackQuery.id, "Заказ отмечен как собранный!");

    if (messageId) {
      await editMessageText(
        botToken,
        chatId,
        messageId,
        `✅ Заказ #${order.orderNumber} отмечен как собранный!\n\nМенеджер уведомлён для организации доставки.`
      );
    }

    notifyManagerOrderPacked(businessId, order.orderNumber, orderId).catch(() => {});

    // Notify client across whichever channel they came from
    const statusText = "⚙️ Ваш заказ в обработке.";
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        botToken: true,
        name: true,
        waPhoneNumberId: true,
        waAccessToken: true,
        fbPageAccessToken: true,
      },
    });
    if (business) {
      // decrypt() — envelope encryption; passthrough для plaintext
      const { decrypt } = await import("@/lib/crypto");
      if (business.botToken) business.botToken = decrypt(business.botToken) || business.botToken;
      if (business.waAccessToken) business.waAccessToken = decrypt(business.waAccessToken) || business.waAccessToken;
      if (business.fbPageAccessToken) business.fbPageAccessToken = decrypt(business.fbPageAccessToken) || business.fbPageAccessToken;

      const clientMsg =
        `${statusText}\n\n` +
        `🛒 Заказ #${order.orderNumber} | ${order.totalPrice.toLocaleString("ru-RU")}\n` +
        `От: ${business.name}`;

      const channel = order.clientChannel;
      if ((channel === "telegram" || !channel) && order.clientTelegramId && business.botToken) {
        await fetch(`https://api.telegram.org/bot${business.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: order.clientTelegramId.toString(), text: clientMsg }),
        }).catch(() => {});
      } else if (
        channel === "whatsapp" &&
        order.clientChannelId &&
        business.waPhoneNumberId &&
        business.waAccessToken
      ) {
        const { sendWAMessage } = await import("@/lib/whatsapp-utils");
        await sendWAMessage(
          business.waPhoneNumberId,
          business.waAccessToken,
          order.clientChannelId,
          clientMsg
        ).catch(() => {});
      } else if (
        (channel === "instagram" || channel === "facebook") &&
        order.clientChannelId &&
        business.fbPageAccessToken
      ) {
        await fetch(`https://graph.facebook.com/v21.0/me/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${business.fbPageAccessToken}`,
          },
          body: JSON.stringify({
            recipient: { id: order.clientChannelId },
            message: { text: clientMsg },
          }),
        }).catch(() => {});
      }
    }
    return;
  }

  // ---- UNSUBSCRIBE ----
  if (data.startsWith("unsubscribe_")) {
    const clientId = data.replace("unsubscribe_", "");

    await prisma.client.update({
      where: { id: clientId },
      data: { isBlocked: true },
    });

    await answerCallbackQuery(botToken, callbackQuery.id, "Вы отписаны от рассылок");
    if (messageId) {
      await editMessageText(
        botToken,
        chatId,
        messageId,
        "Вы отписаны от рассылок. Если захотите снова получать сообщения — просто напишите нам!"
      );
    }
    return;
  }

  // ---- BOOK NEW (from reactivation) ----
  if (data === "book_new" || data.startsWith("book_promo_")) {
    await answerCallbackQuery(botToken, callbackQuery.id);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Отлично! На какую дату и время вы хотите записаться? Напишите, и я подберу свободное время! 📅"
    );
    return;
  }

  // ---- SET LANGUAGE (from /lang command) ----
  if (data.startsWith("set_lang:")) {
    const lang = data.replace("set_lang:", "");
    const langNames: Record<string, string> = {
      ru: "Русский",
      en: "English",
      uz: "O'zbek",
      kz: "Қазақша",
    };

    // Save preferred language to client record
    try {
      await prisma.client.updateMany({
        where: { businessId, telegramId },
        data: { importantNotes: `Preferred language: ${lang}` },
      });
    } catch {}

    await answerCallbackQuery(botToken, callbackQuery.id, langNames[lang] || lang);
    if (messageId) {
      const confirmMsg: Record<string, string> = {
        ru: "✅ Язык установлен: Русский. Теперь я буду отвечать на русском!",
        en: "✅ Language set: English. I'll respond in English from now on!",
        uz: "✅ Til tanlandi: O'zbek. Endi men o'zbek tilida javob beraman!",
        kz: "✅ Тіл таңдалды: Қазақша. Енді мен қазақ тілінде жауап беремін!",
      };
      await editMessageText(botToken, chatId, messageId, confirmMsg[lang] || confirmMsg.ru);
    }
    return;
  }

  // Unknown callback — just acknowledge
  await answerCallbackQuery(botToken, callbackQuery.id);
}
