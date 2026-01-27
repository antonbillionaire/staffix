import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    // Try NextAuth session first
    const session = await auth();
    let userId: string | undefined;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      userId = user?.id;
    }

    // Fallback to cookie-based auth
    if (!userId) {
      const cookieStore = await cookies();
      userId = cookieStore.get("userId")?.value;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { businessType, businessName, phone, address, staffCount, language } = data;

    if (!businessName) {
      return NextResponse.json(
        { error: "Название бизнеса обязательно" },
        { status: 400 }
      );
    }

    // Find or create business for user
    let business = await prisma.business.findFirst({
      where: { userId },
    });

    if (business) {
      // Update existing business
      business = await prisma.business.update({
        where: { id: business.id },
        data: {
          name: businessName,
          phone: phone || null,
          address: address || null,
          businessType: businessType || null,
          staffCount: staffCount ? parseInt(staffCount) || null : null,
          language: language || "ru",
          onboardingCompleted: true,
        },
      });
    } else {
      // Create new business
      business = await prisma.business.create({
        data: {
          userId,
          name: businessName,
          phone: phone || null,
          address: address || null,
          businessType: businessType || null,
          staffCount: staffCount ? parseInt(staffCount) || null : null,
          language: language || "ru",
          onboardingCompleted: true,
          subscription: {
            create: {
              plan: "trial",
              messagesLimit: 100,
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
            },
          },
        },
      });
    }

    return NextResponse.json({
      message: "Onboarding завершён",
      business,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Ошибка сохранения данных" },
      { status: 500 }
    );
  }
}
