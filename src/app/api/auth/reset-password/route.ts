import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    // failMode: "closed" — во время лага БД НЕ разрешаем безлимитный подбор
    // 6-значного кода восстановления. Fail-open здесь = полный компромисс аккаунта.
    const { allowed, retryAfterSeconds } = await rateLimit(`reset:${ip}`, 5, 15, "closed");
    if (!allowed) {
      return NextResponse.json(
        { error: `Слишком много попыток. Попробуйте через ${Math.ceil(retryAfterSeconds / 60)} мин.` },
        { status: 429 }
      );
    }

    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Пароль должен быть минимум 8 символов" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Единый generic-error для всех failure modes (пользователь / токен / срок /
    // неверный код). Атакующему не даём различить причину отказа.
    const genericError = { error: "Неверный или просроченный код" };

    if (
      !user ||
      !user.resetPasswordToken ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      return NextResponse.json(genericError, { status: 400 });
    }

    // bcrypt.compare — константное время, устраняет timing-side channel атаку.
    // Раньше было user.resetPasswordToken !== code — обычное сравнение строк
    // с разным временем ответа в зависимости от где разошлись символы.
    const codeValid = await bcrypt.compare(String(code), user.resetPasswordToken);
    if (!codeValid) {
      return NextResponse.json(genericError, { status: 400 });
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
