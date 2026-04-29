import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { notifyAdmin } from "@/lib/admin-notify";

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

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { businessType, businessTypes, businessName, phone, address, staffCount, language, crmSystem } = data;

    if (!businessName) {
      return NextResponse.json(
        { error: "Название бизнеса обязательно" },
        { status: 400 }
      );
    }

    // Determine dashboard mode from business type
    const SALES_IDS = ["online_shop", "flowers", "other_sales", "travel", "restaurant", "delivery", "cleaning"];
    const resolvedType = businessType || (Array.isArray(businessTypes) && businessTypes[0]) || null;
    const dashboardMode = resolvedType && SALES_IDS.includes(resolvedType) ? "sales" : "service";

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
          businessType: resolvedType,
          businessTypes: Array.isArray(businessTypes) ? businessTypes : [],
          dashboardMode,
          staffCount: staffCount ? parseInt(staffCount) || null : null,
          language: language || "ru",
          crmSystem: crmSystem || null,
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
          businessType: resolvedType,
          businessTypes: Array.isArray(businessTypes) ? businessTypes : [],
          dashboardMode,
          staffCount: staffCount ? parseInt(staffCount) || null : null,
          language: language || "ru",
          crmSystem: crmSystem || null,
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

    // Notify admin about completed onboarding
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    notifyAdmin(
      `📋 <b>Онбординг завершён!</b>\n\n` +
      `👤 <b>Имя:</b> ${user?.name || "—"}\n` +
      `📧 <b>Email:</b> ${user?.email || "—"}\n` +
      `🏢 <b>Бизнес:</b> ${businessName}\n` +
      `📂 <b>Тип:</b> ${Array.isArray(businessTypes) && businessTypes.length > 0 ? businessTypes.join(", ") : businessType || "не указан"}\n` +
      `🕐 <b>Время:</b> ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}`
    ).catch(() => {});

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
