import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 попыток за 15 минут с одного IP
    const ip = getClientIp(request);
    const { allowed, retryAfterSeconds } = await rateLimit(`login:${ip}`, 5, 15);
    if (!allowed) {
      return NextResponse.json(
        { error: `Слишком много попыток входа. Попробуйте через ${Math.ceil(retryAfterSeconds / 60)} мин.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email и пароль обязательны" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        businesses: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    // Remove password and sensitive business fields from response
    const { password: _, ...userWithoutPassword } = user;
    const sanitizedUser = {
      ...userWithoutPassword,
      businesses: userWithoutPassword.businesses.map(({ botToken, fbPageAccessToken, waAccessToken, webhookSecret, igBusinessAccountId, fbPageId, waPhoneNumberId, ...safeBusiness }) => safeBusiness),
    };

    return NextResponse.json({
      message: "Вход выполнен",
      user: sanitizedUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Ошибка входа" },
      { status: 500 }
    );
  }
}
