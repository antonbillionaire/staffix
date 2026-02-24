import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Новый пароль должен быть минимум 8 символов" }, { status: 400 });
    }

    // For Google OAuth users with empty password, skip old password check
    const hasPassword = user.password && user.password.length > 0;
    if (hasPassword) {
      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) {
        return NextResponse.json({ error: "Неверный текущий пароль" }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: "Пароль успешно изменён" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
