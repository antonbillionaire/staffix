import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { notifyNewRegistration } from "@/lib/admin-notify";
import bcrypt from "bcryptjs";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 3 регистрации за 60 минут с одного IP
    const ip = getClientIp(request);
    const { allowed, retryAfterSeconds } = await rateLimit(`register:${ip}`, 3, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: `Слишком много попыток регистрации. Попробуйте через ${Math.ceil(retryAfterSeconds / 60)} мин.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const { name, email, password, businessName, referralCode: bodyRefCode } = await request.json();

    // Referral code: from request body (passed by frontend from cookie) or cookie directly
    const cookieRefCode = request.cookies.get("staffix_ref")?.value;
    const referralCode = bodyRefCode || cookieRefCode || null;

    // Validate input
    if (!name || !email || !password || !businessName) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      );
    }

    if (password.length < 10) {
      return NextResponse.json(
        { error: "Пароль должен быть минимум 10 символов и содержать хотя бы одну букву и одну цифру" },
        { status: 400 }
      );
    }

    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: "Пароль должен содержать хотя бы одну букву и одну цифру" },
        { status: 400 }
      );
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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
        email: normalizedEmail,
        password: hashedPassword,
        emailVerified: false,
        verificationToken: verificationCode,
        verificationExpires: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
        referredByCode: referralCode,
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

    // Track partner referral (non-blocking)
    if (referralCode) {
      prisma.partner.findUnique({ where: { referralCode } }).then((partner) => {
        if (partner) {
          return prisma.partnerReferral.create({
            data: {
              userId: user.id,
              userEmail: email,
              referralCode,
              partnerId: partner.id,
            },
          });
        }
      }).catch(console.error);
    }

    // Remove password from response
    const { password: _, verificationToken: __, ...userWithoutPassword } = user;

    // Notify admin about new registration (non-blocking)
    notifyNewRegistration(name, email, businessName).catch(() => {});

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
