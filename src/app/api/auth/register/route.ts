import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  try {
    const { name, email, password, businessName } = await request.json();

    // Validate input
    if (!name || !email || !password || !businessName) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен быть минимум 6 символов" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with business and trial subscription
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
        verificationToken,
        verificationExpires,
        businesses: {
          create: {
            name: businessName,
            subscription: {
              create: {
                plan: "trial",
                messagesLimit: 100,
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
              },
            },
          },
        },
      },
      include: {
        businesses: true,
      },
    });

    // Remove password from response
    const { password: _, verificationToken: __, ...userWithoutPassword } = user;

    // TODO: Send verification email via SMTP
    // For now, return verification token for testing
    const verificationUrl = `${process.env.NEXTAUTH_URL || "https://staffix.io"}/verify-email?token=${verificationToken}`;

    return NextResponse.json({
      message: "Регистрация успешна. Проверьте email для подтверждения.",
      user: userWithoutPassword,
      requiresVerification: true,
      // Remove verificationUrl in production after SMTP is configured
      verificationUrl: process.env.NODE_ENV === "development" ? verificationUrl : undefined,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Ошибка регистрации" },
      { status: 500 }
    );
  }
}
