import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { allowed } = await rateLimit(`reset:${ip}`, 5, 15);
    if (!allowed) {
      return NextResponse.json({ error: "Слишком много попыток" }, { status: 429 });
    }

    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Пароль должен быть минимум 8 символов" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (
      !user ||
      !user.resetPasswordToken ||
      !user.resetPasswordExpires ||
      user.resetPasswordToken !== code ||
      user.resetPasswordExpires < new Date()
    ) {
      return NextResponse.json({ error: "Неверный или просроченный код" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return NextResponse.json({ message: "Пароль успешно изменён" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
