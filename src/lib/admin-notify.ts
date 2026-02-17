// Send notifications to admin via Telegram (using sales bot token)

/**
 * Send a Telegram notification to admin about platform events
 * Uses SALES_BOT_TELEGRAM_TOKEN to send to SALES_ADMIN_CHAT_ID
 */
export async function notifyAdmin(message: string): Promise<boolean> {
  const botToken = process.env.SALES_BOT_TELEGRAM_TOKEN;
  const chatId = process.env.SALES_ADMIN_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("Admin notify: SALES_BOT_TELEGRAM_TOKEN or SALES_ADMIN_CHAT_ID not set");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Admin notify error:", error);
    return false;
  }
}

/**
 * Notify admin about new user registration
 */
export async function notifyNewRegistration(
  userName: string,
  email: string,
  businessName: string
): Promise<void> {
  await notifyAdmin(
    `🆕 <b>Новая регистрация!</b>\n\n` +
    `👤 <b>Имя:</b> ${userName}\n` +
    `📧 <b>Email:</b> ${email}\n` +
    `🏢 <b>Бизнес:</b> ${businessName}\n` +
    `📋 <b>План:</b> Trial (14 дней)\n` +
    `🕐 <b>Время:</b> ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}`
  );
}

/**
 * Notify admin about email verification (user confirmed their email)
 */
export async function notifyEmailVerified(
  userName: string,
  email: string
): Promise<void> {
  await notifyAdmin(
    `✅ <b>Email подтверждён</b>\n\n` +
    `👤 ${userName}\n` +
    `📧 ${email}`
  );
}

/**
 * Notify admin about new subscription payment
 */
export async function notifyNewPayment(
  userName: string,
  email: string,
  plan: string,
  amount: number
): Promise<void> {
  await notifyAdmin(
    `💰 <b>Новая оплата!</b>\n\n` +
    `👤 <b>Клиент:</b> ${userName}\n` +
    `📧 <b>Email:</b> ${email}\n` +
    `📋 <b>План:</b> ${plan}\n` +
    `💵 <b>Сумма:</b> $${amount}\n` +
    `🕐 <b>Время:</b> ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}`
  );
}

/**
 * Notify admin about bot connection (user connected their Telegram bot)
 */
export async function notifyBotConnected(
  userName: string,
  businessName: string,
  botUsername: string
): Promise<void> {
  await notifyAdmin(
    `🤖 <b>Бот подключён!</b>\n\n` +
    `👤 ${userName}\n` +
    `🏢 ${businessName}\n` +
    `🔗 @${botUsername}`
  );
}
