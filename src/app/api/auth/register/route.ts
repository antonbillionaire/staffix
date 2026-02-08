import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

    // Generate 6-digit verification code
    const verificationCode = generateVerificationCode();

    // Create user with business and trial subscription
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
        verificationToken: verificationCode,
        verificationExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
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

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationCode, name);

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      // Still allow registration, user can request resend
    }

    return NextResponse.json({
      message: "Регистрация успешна. Код подтверждения отправлен на email.",
      user: userWithoutPassword,
      requiresVerification: true,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Ошибка регистрации" },
      { status: 500 }
    );
  }
}
