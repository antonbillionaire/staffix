import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";

const FROM_EMAIL = process.env.FROM_EMAIL || "Staffix <noreply@staffix.io>";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { allowed, retryAfterSeconds } = await rateLimit(`forgot:${ip}`, 3, 15);
    if (!allowed) {
      return NextResponse.json(
        { error: `Слишком много попыток. Попробуйте через ${Math.ceil(retryAfterSeconds / 60)} мин.` },
        { status: 429 }
      );
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Укажите email" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ message: "Если аккаунт существует, код отправлен на email" });
    }

    const code = generateCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: code,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Send email
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `${code} - Сброс пароля Staffix`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #333;">Сброс пароля</h2>
            <p>Ваш код для сброса пароля:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0;">${code}</div>
            <p style="color: #666; font-size: 14px;">Код действителен 15 минут. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
          </div>
        `,
      });
    } else {
      console.log(`[DEV] Reset code for ${email}: ${code}`);
    }

    return NextResponse.json({ message: "Если аккаунт существует, код отправлен на email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
