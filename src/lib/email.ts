import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "Staffix <noreply@staffix.io>";

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
