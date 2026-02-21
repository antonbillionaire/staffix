import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { email, name, subject, body } = await request.json();

    if (!email || !subject || !body) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email-сервис не настроен. Добавьте RESEND_API_KEY в Vercel." },
        { status: 503 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const FROM_EMAIL = process.env.FROM_EMAIL || "Staffix <noreply@staffix.io>";

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a1a; margin: 0; padding: 40px 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: linear-gradient(135deg, #12122a 0%, #1a1a3a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
            <div style="padding: 28px 32px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <span style="font-size: 20px; font-weight: 700; color: #fff;">Staffix</span>
            </div>
            <div style="padding: 32px;">
              <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Здравствуйте, <strong style="color: #fff;">${name}</strong>!
              </p>
              <div style="color: #d1d5db; font-size: 15px; line-height: 1.8; white-space: pre-wrap;">${body}</div>
            </div>
            <div style="padding: 20px 32px; background: rgba(0,0,0,0.2); text-align: center;">
              <p style="color: #4b5563; font-size: 12px; margin: 0;">© 2025 Staffix — staffix.io</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin send-email error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
