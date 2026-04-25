import { Resend } from "resend";

const FROM_EMAIL = process.env.FROM_EMAIL || "Staffix <noreply@staffix.io>";

// Lazy initialization to avoid errors during build
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.log(`[DEV] Verification code for ${email}: ${code}`);
      return { success: true }; // Allow registration in dev mode without email
    }

    const resend = getResend();
    if (!resend) {
      return { success: false, error: "Email service not configured" };
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${code} - Код подтверждения Staffix`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a1a; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(135deg, #12122a 0%, #1a1a3a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">

            <!-- Header -->
            <div style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 24px; line-height: 48px;">🤖</span>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">Staffix</h1>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
              <p style="color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Здравствуйте, <span style="color: #ffffff; font-weight: 500;">${name}</span>!
              </p>

              <p style="color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Ваш код подтверждения:
              </p>

              <!-- Code Box -->
              <div style="background: rgba(59, 130, 246, 0.1); border: 2px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #ffffff; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
                  ${code}
                </span>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                Код действителен <strong style="color: #9ca3af;">15 минут</strong>.<br>
                Если вы не регистрировались на Staffix, проигнорируйте это письмо.
              </p>
            </div>

            <!-- Footer -->
            <div style="padding: 24px 32px; background: rgba(0,0,0,0.2); text-align: center;">
              <p style="color: #4b5563; font-size: 12px; margin: 0;">
                © 2025 Staffix. AI-сотрудник для вашего бизнеса.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Email send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Email service error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ошибка отправки email",
    };
  }
}

// Send subscription expiry reminder email
export async function sendSubscriptionReminder(
  email: string,
  name: string,
  planName: string,
  daysLeft: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    if (!resend) {
      console.log(`[DEV] Subscription reminder for ${email}: ${daysLeft} days left`);
      return { success: true };
    }

    const urgency = daysLeft <= 1 ? "last" : daysLeft <= 3 ? "urgent" : "normal";
    const urgencyColor = urgency === "last" ? "#ef4444" : urgency === "urgent" ? "#f59e0b" : "#3b82f6";
    const daysText = daysLeft <= 1
      ? "Сегодня последний день"
      : `Осталось ${daysLeft} ${daysLeft <= 4 ? "дня" : "дней"}`;
    const subject = daysLeft <= 1
      ? `Подписка Staffix истекает сегодня!`
      : `Подписка Staffix: осталось ${daysLeft} ${daysLeft <= 4 ? "дня" : "дней"}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a1a; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(135deg, #12122a 0%, #1a1a3a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
            <div style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 24px; line-height: 48px;">🤖</span>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">Staffix</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Здравствуйте, <span style="color: #ffffff; font-weight: 500;">${name}</span>!
              </p>
              <div style="background: ${urgencyColor}15; border: 1px solid ${urgencyColor}40; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="font-size: 20px; font-weight: 700; color: ${urgencyColor}; margin: 0 0 4px;">${daysText}</p>
                <p style="font-size: 14px; color: #9ca3af; margin: 0;">План: ${planName}</p>
              </div>
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                ${daysLeft <= 1
                  ? "Чтобы не потерять доступ к AI-сотруднику, CRM и автоматизациям — продлите подписку сейчас."
                  : "Продлите подписку, чтобы ваш AI-сотрудник продолжал работать без перебоев."}
              </p>
              <a href="https://www.staffix.io/pricing" style="display: block; text-align: center; padding: 14px 24px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                Продлить подписку
              </a>
            </div>
            <div style="padding: 24px 32px; background: rgba(0,0,0,0.2); text-align: center;">
              <p style="color: #4b5563; font-size: 12px; margin: 0;">
                © 2025 Staffix. AI-сотрудник для вашего бизнеса.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Subscription reminder email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Subscription reminder error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ошибка отправки email",
    };
  }
}

// Send support ticket notification to admin
export async function sendSupportTicketNotification(
  ticketId: string,
  subject: string,
  message: string,
  userEmail: string,
  userName: string,
  priority: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      console.log("[DEV] Support ticket notification - no admin email configured");
      return { success: true };
    }

    const resend = getResend();
    if (!resend) {
      console.log("[DEV] New support ticket:", { ticketId, subject, userEmail });
      return { success: true };
    }

    const priorityLabels: Record<string, string> = {
      low: "🟢 Низкий",
      normal: "🟡 Обычный",
      high: "🔴 Высокий",
    };

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `[Staffix Support] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; border: 1px solid #e5e5e5;">
            <h2 style="color: #1a1a1a; margin: 0 0 16px;">Новое обращение в поддержку</h2>

            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 0 0 8px;"><strong>Тикет ID:</strong> ${ticketId}</p>
              <p style="margin: 0 0 8px;"><strong>От:</strong> ${userName} (${userEmail})</p>
              <p style="margin: 0 0 8px;"><strong>Приоритет:</strong> ${priorityLabels[priority] || priority}</p>
              <p style="margin: 0;"><strong>Тема:</strong> ${subject}</p>
            </div>

            <h3 style="color: #1a1a1a; margin: 16px 0 8px;">Сообщение:</h3>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${message}</div>

            <p style="color: #666; font-size: 12px; margin-top: 24px;">
              Это автоматическое уведомление от Staffix.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Support notification email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Support notification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ошибка отправки уведомления",
    };
  }
}

// Send welcome onboarding email after email verification
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    if (!resend) {
      console.log(`[DEV] Welcome email for ${email}`);
      return { success: true };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io";

    const { error } = await resend.emails.send({
      from: "Staffix Support <support@staffix.io>",
      to: email,
      replyTo: "support@staffix.io",
      subject: `Добро пожаловать в Staffix, ${name}! Ваш AI-сотрудник готов к настройке`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 40px 20px; color: #1a1a2e;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">

            <!-- Header -->
            <div style="padding: 32px 32px 24px; border-bottom: 1px solid #e5e7eb;">
              <h1 style="color: #1a1a2e; font-size: 24px; font-weight: 700; margin: 0 0 8px;">Здравствуйте, ${name}!</h1>
              <p style="color: #4b5563; font-size: 15px; margin: 0; line-height: 1.6;">
                Команда Staffix благодарит вас за регистрацию. Мы рады приветствовать вас на платформе.
              </p>
            </div>

            <!-- Intro -->
            <div style="padding: 28px 32px 12px;">
              <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
                Вы получили <strong>14 дней бесплатного доступа</strong> со всеми функциями. Чтобы AI-сотрудник заработал на полную мощность, потребуется около 15 минут на настройку.
              </p>

              <p style="color: #374151; font-size: 15px; font-weight: 600; margin: 0 0 8px;">Первые шаги</p>
            </div>

            <!-- Steps -->
            <div style="padding: 0 32px 24px;">
              ${[
                ["1", "Подключите канал общения с клиентами", "Telegram, WhatsApp, Instagram или Facebook — где общаются ваши клиенты. Подключение занимает 2–5 минут.", "/dashboard/channels"],
                ["2", "Загрузите данные о бизнесе в Базу знаний", "Прайс, описание услуг, FAQ, документы. Поддерживаются PDF, DOCX, Excel, TXT. Чем больше данных — тем точнее отвечает AI.", "/dashboard/knowledge"],
                ["3", "Настройте услуги или товары", "Добавьте всё что вы продаёте — с ценами, описанием и фото. Каталог можно загрузить из Excel, PDF или прямо с вашего сайта по URL.", "/dashboard/services"],
                ["4", "Добавьте команду", "Сотрудники, расписание, ставки и комиссии. Каждый продавец получит персональную ссылку для своих клиентов — заказы будут идти именно ему.", "/dashboard/staff"],
                ["5", "Протестируйте AI-сотрудника", "Напишите вашему боту первое сообщение и посмотрите как он отвечает. Если ответ нужно поправить — нажмите кнопку коррекции прямо в чате.", "/dashboard"],
              ].map(([num, title, desc, link]) => `
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 18px;">
                  <tr>
                    <td valign="top" style="width: 36px; padding-right: 14px;">
                      <div style="width: 28px; height: 28px; background: #1a1a2e; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700; color: #ffffff;">${num}</div>
                    </td>
                    <td valign="top">
                      <p style="color: #1a1a2e; font-size: 15px; font-weight: 600; margin: 4px 0 4px;">${title}</p>
                      <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.55;">${desc}</p>
                      <a href="${appUrl}${link}" style="color: #2563eb; font-size: 13px; text-decoration: none; margin-top: 4px; display: inline-block;">Перейти →</a>
                    </td>
                  </tr>
                </table>
              `).join("")}
            </div>

            <!-- CTA Button -->
            <div style="padding: 0 32px 24px;">
              <a href="${appUrl}/dashboard" style="display: block; text-align: center; padding: 14px 24px; background: #1a1a2e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                Открыть дашборд
              </a>
            </div>

            <!-- Capabilities -->
            <div style="padding: 0 32px 28px;">
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <p style="color: #1a1a2e; font-size: 14px; font-weight: 600; margin: 0 0 12px;">Что умеет ваш AI-сотрудник</p>
                <ul style="color: #4b5563; font-size: 13.5px; line-height: 1.8; margin: 0; padding-left: 18px;">
                  <li>Отвечает за 3 секунды, 24/7, на 4 языках (русский, английский, узбекский, казахский)</li>
                  <li>Записывает клиентов на приём, оформляет заказы, проверяет расписание мастеров</li>
                  <li>Отправляет фото товаров и ссылки на сайт прямо в чат клиента</li>
                  <li>Предлагает пакеты услуг со скидкой и делает допродажи</li>
                  <li>Помнит каждого клиента — историю визитов, предпочтения, заметки</li>
                  <li>Учитывает несовместимости услуг (не предложит массаж после ботокса)</li>
                  <li>Автоматически считает зарплаты сотрудников (ставка + комиссия + премии и штрафы)</li>
                  <li>Отправляет напоминания за 24ч и 2ч до визита, собирает отзывы</li>
                  <li>Возвращает ушедших клиентов через автоматическую реактивацию</li>
                </ul>
              </div>
            </div>

            <!-- Documentation -->
            <div style="padding: 0 32px 28px;">
              <p style="color: #1a1a2e; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Полная документация</p>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                Подробные инструкции по каждому разделу со скриншотами и примерами:
              </p>
              <a href="${appUrl}/docs" style="color: #2563eb; font-size: 14px; text-decoration: none;">${appUrl}/docs</a>
            </div>

            <!-- Support -->
            <div style="padding: 0 32px 28px;">
              <p style="color: #1a1a2e; font-size: 14px; font-weight: 600; margin: 0 0 10px;">Нужна помощь?</p>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0;">
                Если возникнут вопросы — напишите нам. Команда поддержки отвечает в течение часа в рабочее время.<br>
                Email: <a href="mailto:support@staffix.io" style="color: #2563eb; text-decoration: none;">support@staffix.io</a><br>
                Telegram: <a href="https://t.me/staffix_support_bot" style="color: #2563eb; text-decoration: none;">@staffix_support_bot</a>
              </p>
            </div>

            <!-- Footer -->
            <div style="padding: 20px 32px; background: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #1a1a2e; font-size: 13px; font-weight: 600; margin: 0 0 4px;">Команда Staffix</p>
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                <a href="${appUrl}" style="color: #6b7280; text-decoration: none;">staffix.io</a> · AI-сотрудник для вашего бизнеса
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Welcome email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Welcome email service error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ошибка отправки",
    };
  }
}

// Send broadcast email to a user
export async function sendBroadcastEmail(
  email: string,
  name: string,
  businessName: string,
  plan: string,
  subject: string,
  content: string,
  attachments?: Array<{ filename: string; content: string }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    if (!resend) {
      console.log(`[DEV] Broadcast email for ${email}`);
      return { success: true };
    }

    // Replace template variables
    const processedContent = content
      .replace(/\{\{name\}\}/g, name || "Пользователь")
      .replace(/\{\{business\}\}/g, businessName || "")
      .replace(/\{\{plan\}\}/g, plan || "trial");

    const sendParams: Parameters<typeof resend.emails.send>[0] = {
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a1a; margin: 0; padding: 40px 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: linear-gradient(135deg, #12122a 0%, #1a1a3a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
            <div style="padding: 28px 32px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <span style="font-size: 20px; font-weight: 700; color: #fff;">Staffix</span>
            </div>
            <div style="padding: 32px;">
              <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Здравствуйте, <strong style="color: #fff;">${name}</strong>!
              </p>
              <div style="color: #d1d5db; font-size: 15px; line-height: 1.8; white-space: pre-wrap;">${processedContent}</div>
            </div>
            <div style="padding: 20px 32px; background: rgba(0,0,0,0.2); text-align: center;">
              <p style="color: #4b5563; font-size: 12px; margin: 0;">© 2025 Staffix — staffix.io</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    if (attachments && attachments.length > 0) {
      sendParams.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
      }));
    }

    const { error } = await resend.emails.send(sendParams);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ошибка отправки",
    };
  }
}

// Outreach email — холодное письмо для новых лидов
export async function sendOutreachEmail(
  to: string,
  businessName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    if (!resend) {
      console.log(`[DEV] Outreach email for ${to} (${businessName})`);
      return { success: true };
    }

    const subject = `Идеальный сотрудник для ${businessName}: обучается за 5 минут, не увольняется`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">

            <!-- Header -->
            <div style="padding: 20px 32px; border-bottom: 1px solid #f3f4f6;">
              <span style="font-size: 18px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">Staffix</span>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">Добрый день!</p>

              <!-- Hook block -->
              <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="color: #111827; font-size: 16px; font-weight: 600; line-height: 1.5; margin: 0;">
                  А что если у вас был бы сотрудник, который обучается за 5 минут, работает круглосуточно и никогда не попросит прибавку к зарплате?
                </p>
              </div>

              <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
                Меня зовут Антон — я основатель Staffix, и я создал именно такого сотрудника.
              </p>

              <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
                За годы работы с бизнесами в сфере услуг я видел одну и ту же проблему: хорошего администратора сложно найти и ещё сложнее удержать. Уходят, болеют, обучаются неделями — и снова уходят. Staffix решает это раз и навсегда.
              </p>

              <!-- Feature block -->
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
                <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 14px;">Ваш новый ИИ-сотрудник:</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; color: #f97316; font-size: 16px; width: 24px;">→</td><td style="padding: 6px 0; color: #374151; font-size: 14px; line-height: 1.5;">Обучается за <strong>5 минут</strong> на данных вашего бизнеса — и помнит всё</td></tr>
                  <tr><td style="padding: 6px 0; color: #f97316; font-size: 16px; width: 24px;">→</td><td style="padding: 6px 0; color: #374151; font-size: 14px; line-height: 1.5;">Отвечает клиентам <strong>24/7</strong> — ни одно обращение не останется без ответа</td></tr>
                  <tr><td style="padding: 6px 0; color: #f97316; font-size: 16px; width: 24px;">→</td><td style="padding: 6px 0; color: #374151; font-size: 14px; line-height: 1.5;">Ведёт запись, консультирует и помнит каждого клиента</td></tr>
                  <tr><td style="padding: 6px 0; color: #f97316; font-size: 16px; width: 24px;">→</td><td style="padding: 6px 0; color: #374151; font-size: 14px; line-height: 1.5;"><strong>Никогда</strong> не уволится, не заболеет и не совершит случайных ошибок</td></tr>
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="https://staffix.io" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px;">
                  Попробовать бесплатно →
                </a>
              </div>

              <!-- Offer -->
              <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px;">
                <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 4px;">Специальное предложение</p>
                <p style="color: #78350f; font-size: 14px; line-height: 1.6; margin: 0;">
                  Первые <strong>14 дней — полностью бесплатно</strong>. И ещё <strong>30 дней сверху</strong> — за честную обратную связь: что добавить, что улучшить, чего не хватает именно для вашего бизнеса. Ваше мнение напрямую влияет на то, каким станет Staffix.
                </p>
              </div>

              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 4px;">
                С уважением,
              </p>
              <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0;">
                Антон, основатель Staffix
              </p>
            </div>

            <!-- Footer -->
            <div style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                <a href="https://staffix.io" style="color: #f97316; text-decoration: none;">staffix.io</a> — AI-сотрудник для вашего бизнеса
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ошибка отправки",
    };
  }
}

// Send Telegram notification with retry
export async function sendTelegramNotification(
  message: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  const chatId = process.env.SUPPORT_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("[DEV] Telegram notification - not configured");
    return { success: true };
  }

  // Retry up to 3 times with exponential backoff
  const maxRetries = 3;
  let lastError: string = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`Telegram notification sent successfully (attempt ${attempt})`);
        return { success: true };
      }

      const errorText = await response.text();
      lastError = errorText;
      console.error(`Telegram notification error (attempt ${attempt}):`, errorText);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      console.error(`Telegram notification failed (attempt ${attempt}):`, error);

      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  console.error("Telegram notification failed after all retries");
  return { success: false, error: lastError };
}

// ========================================
// ONBOARDING DRIP EMAILS
// ========================================

const DRIP_FOOTER = `
  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
    <p style="color: #6b7280; font-size: 12px; margin: 0;">
      © Staffix — AI-сотрудник для вашего бизнеса<br/>
      <a href="https://www.staffix.io" style="color: #3b82f6;">www.staffix.io</a>
    </p>
  </div>
`;

// Day 2: Remind to add services
export async function sendDripServicesReminder(
  email: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Drip services reminder for ${email}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Добавьте услуги — и AI начнёт работать",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, system-ui, sans-serif; background: #0a0a1a; color: #e5e7eb; padding: 40px 30px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #9333ea); border-radius: 16px; width: 60px; height: 60px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 28px; font-weight: bold;">S</span>
            </div>
          </div>
          <h1 style="color: white; font-size: 22px; text-align: center; margin-bottom: 20px;">
            ${name}, осталось добавить услуги!
          </h1>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; text-align: center;">
            Ваш AI-сотрудник почти готов к работе. Чтобы он мог рассказывать клиентам о ваших услугах и записывать их — добавьте хотя бы одну услугу.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.staffix.io/dashboard/services" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
              Добавить услуги
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px; text-align: center;">
            Это займёт 2-3 минуты. Укажите название, цену и длительность.
          </p>
          ${DRIP_FOOTER}
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Send error" };
  }
}

// Day 5: Remind to connect a channel
export async function sendDripChannelReminder(
  email: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Drip channel reminder for ${email}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Подключите канал — клиенты ждут",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, system-ui, sans-serif; background: #0a0a1a; color: #e5e7eb; padding: 40px 30px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #9333ea); border-radius: 16px; width: 60px; height: 60px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 28px; font-weight: bold;">S</span>
            </div>
          </div>
          <h1 style="color: white; font-size: 22px; text-align: center; margin-bottom: 20px;">
            ${name}, подключите канал связи
          </h1>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; text-align: center;">
            AI-сотрудник готов отвечать клиентам, но ему нужен канал: Telegram, WhatsApp или Instagram. Подключите один из них — и бот начнёт работать.
          </p>
          <div style="text-align: center; margin: 30px 0; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a href="https://www.staffix.io/dashboard/channels/telegram" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Telegram
            </a>
            <a href="https://www.staffix.io/dashboard/channels/whatsapp" style="background: #16a34a; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
              WhatsApp
            </a>
            <a href="https://www.staffix.io/dashboard/channels/meta" style="background: #e11d48; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Instagram
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px; text-align: center;">
            Самый быстрый — Telegram (5 минут). WhatsApp и Instagram требуют бизнес-аккаунт.
          </p>
          ${DRIP_FOOTER}
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Send error" };
  }
}

// Day 14: Re-engagement for inactive users
export async function sendDripReengageReminder(
  email: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Drip reengage reminder for ${email}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${name}, нужна помощь с настройкой?`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, system-ui, sans-serif; background: #0a0a1a; color: #e5e7eb; padding: 40px 30px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #9333ea); border-radius: 16px; width: 60px; height: 60px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 28px; font-weight: bold;">S</span>
            </div>
          </div>
          <h1 style="color: white; font-size: 22px; text-align: center; margin-bottom: 20px;">
            ${name}, мы можем помочь!
          </h1>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; text-align: center;">
            Заметили что вы ещё не завершили настройку AI-сотрудника. Может быть возникли вопросы? Мы готовы помочь — напишите нам и мы настроим всё вместе.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.staffix.io/dashboard" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
              Вернуться в Staffix
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px; text-align: center;">
            Ответьте на это письмо или напишите нам в поддержку — поможем с настройкой бесплатно.
          </p>
          ${DRIP_FOOTER}
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Send error" };
  }
}
