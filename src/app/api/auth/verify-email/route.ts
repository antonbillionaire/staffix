import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail, sendWelcomeEmail } from "@/lib/email";
import { notifyEmailVerified } from "@/lib/admin-notify";

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Verify code
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email и код обязательны" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email уже подтверждён" },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      return NextResponse.json(
        { error: "Код истёк. Запросите новый код." },
        { status: 400 }
      );
    }

    // Check if code matches
    if (user.verificationToken !== code) {
      return NextResponse.json(
        { error: "Неверный код" },
        { status: 400 }
      );
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
      },
    });

    // Notify admin
    notifyEmailVerified(user.name, user.email).catch(() => {});

    // Send welcome onboarding email
    sendWelcomeEmail(user.email, user.name).catch(() => {});

    return NextResponse.json({
      message: "Email успешно подтверждён",
      success: true,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Ошибка верификации" },
      { status: 500 }
    );
  }
}

// Resend verification code
export async function PUT(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email не указан" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email уже подтверждён" },
        { status: 400 }
      );
    }

    // Generate new 6-digit code
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: verificationCode,
        verificationExpires,
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationCode, user.name);

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      return NextResponse.json(
        { error: "Ошибка отправки email. Попробуйте позже." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Новый код отправлен на ваш email",
      success: true,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Ошибка отправки" },
      { status: 500 }
    );
  }
}
