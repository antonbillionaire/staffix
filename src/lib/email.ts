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
      from: FROM_EMAIL,
      to: email,
      subject: "Добро пожаловать в Staffix! Запустите AI-сотрудника за 5 минут",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a1a; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: linear-gradient(135deg, #12122a 0%, #1a1a3a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">

            <!-- Header -->
            <div style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%);">
              <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 16px; margin-bottom: 16px; text-align: center; line-height: 56px; font-size: 28px;">🤖</div>
              <h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 0 0 8px;">Добро пожаловать!</h1>
              <p style="color: #9ca3af; font-size: 15px; margin: 0;">Staffix готов к запуску, ${name}</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
              <p style="color: #9ca3af; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
                Email подтверждён ✅<br>
                У вас есть <strong style="color: #fff;">14 дней бесплатного доступа</strong>. Запустите AI-сотрудника прямо сейчас — это займёт 5 минут.
              </p>

              <!-- Steps -->
              <div style="margin-bottom: 28px;">
                <p style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 0 0 16px;">Как запустить за 5 шагов:</p>

                ${[
                  ["1", "#3b82f6", "Создайте Telegram-бота", "Откройте Telegram, напишите @BotFather, отправьте /newbot — получите токен."],
                  ["2", "#8b5cf6", "Добавьте токен в Staffix", "В дашборде → Настройки бота → вставьте токен → нажмите «Подключить»."],
                  ["3", "#06b6d4", "Добавьте услуги", "Раздел «Услуги» → добавьте название, цену и длительность каждой услуги."],
                  ["4", "#10b981", "Добавьте мастеров", "Раздел «Сотрудники» → добавьте мастеров и настройте их расписание."],
                  ["5", "#f59e0b", "Протестируйте бота", "Напишите вашему боту в Telegram: «Хочу записаться» — AI всё сделает сам."],
                ].map(([num, color, title, desc]) => `
                  <div style="display: flex; gap: 16px; margin-bottom: 16px; align-items: flex-start;">
                    <div style="flex-shrink: 0; width: 32px; height: 32px; background: ${color}20; border: 1px solid ${color}40; border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px; font-weight: 700; color: ${color};">${num}</div>
                    <div>
                      <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 4px 0 4px;">${title}</p>
                      <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.5;">${desc}</p>
                    </div>
                  </div>
                `).join("")}
              </div>

              <!-- CTA Button -->
              <a href="${appUrl}/dashboard" style="display: block; text-align: center; padding: 16px 24px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
                Открыть дашборд →
              </a>

              <!-- Tips -->
              <div style="background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.15); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #60a5fa; font-size: 13px; font-weight: 600; margin: 0 0 12px;">💡 Советы для максимальной эффективности:</p>
                <ul style="color: #9ca3af; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Заполните раздел «FAQ» — бот будет отвечать на частые вопросы клиентов</li>
                  <li>Включите автоматические напоминания — снизит неявки на 40–60%</li>
                  <li>Добавьте ссылки на Google Maps и 2GIS для сбора отзывов</li>
                  <li>Укажите часовой пояс, чтобы записи создавались правильно</li>
                </ul>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                Есть вопросы? Напишите нам — <a href="mailto:support@staffix.io" style="color: #60a5fa;">support@staffix.io</a><br>
                Или в Telegram: <a href="https://t.me/staffix_support" style="color: #60a5fa;">@staffix_support</a>
              </p>
            </div>

            <!-- Footer -->
            <div style="padding: 20px 32px; background: rgba(0,0,0,0.2); text-align: center; border-top: 1px solid rgba(255,255,255,0.05);">
              <p style="color: #4b5563; font-size: 12px; margin: 0;">
                © 2025 Staffix — AI-сотрудник для вашего бизнеса<br>
                <a href="${appUrl}" style="color: #6b7280;">staffix.io</a>
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
