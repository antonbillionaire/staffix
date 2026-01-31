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
