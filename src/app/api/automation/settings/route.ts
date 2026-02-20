import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { auth } from "@/auth";

// Helper to get current user's business
async function getCurrentBusiness() {
  const session = await auth();
  let userId: string | undefined;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    userId = user?.id;
  }

  if (!userId) {
    const cookieStore = await cookies();
    userId = cookieStore.get("userId")?.value;
  }

  if (!userId) {
    return null;
  }

  return prisma.business.findFirst({
    where: { userId },
  });
}

// GET - получить настройки автоматизации
export async function GET() {
  try {
    const business = await getCurrentBusiness();

    if (!business) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    // Get or create automation settings
    let settings = await prisma.automationSettings.findUnique({
      where: { businessId: business.id },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.automationSettings.create({
        data: {
          businessId: business.id,
        },
      });
    }

    // Get stats
    const [remindersSent, reviewsCollected, clientsReactivated] = await Promise.all([
      prisma.scheduledReminder.count({
        where: {
          businessId: business.id,
          status: "sent",
          type: { in: ["reminder_24h", "reminder_2h"] },
        },
      }),
      prisma.review.count({
        where: { businessId: business.id },
      }),
      prisma.scheduledReminder.count({
        where: {
          businessId: business.id,
          status: "sent",
          type: "reactivation",
        },
      }),
    ]);

    return NextResponse.json({
      settings: {
        reminder24hEnabled: settings.reminder24hEnabled,
        reminder2hEnabled: settings.reminder2hEnabled,
        reviewEnabled: settings.reviewEnabled,
        reviewDelayHours: settings.reviewDelayHours,
        reviewGoogleLink: settings.reviewGoogleLink || "",
        review2gisLink: settings.review2gisLink || "",
        reviewYandexLink: settings.reviewYandexLink || "",
        reactivationEnabled: settings.reactivationEnabled,
        reactivationDays: settings.reactivationDays,
        reactivationDiscount: settings.reactivationDiscount,
      },
      stats: {
        remindersSent,
        reviewsCollected,
        clientsReactivated,
      },
    });
  } catch (error) {
    console.error("Get automation settings error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

// POST - сохранить настройки автоматизации
export async function POST(request: Request) {
  try {
    const business = await getCurrentBusiness();

    if (!business) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    const data = await request.json();

    // Upsert automation settings
    const settings = await prisma.automationSettings.upsert({
      where: { businessId: business.id },
      update: {
        reminder24hEnabled: data.reminder24hEnabled ?? true,
        reminder2hEnabled: data.reminder2hEnabled ?? true,
        reviewEnabled: data.reviewEnabled ?? true,
        reviewDelayHours: data.reviewDelayHours ?? 2,
        reviewGoogleLink: data.reviewGoogleLink || null,
        review2gisLink: data.review2gisLink || null,
        reviewYandexLink: data.reviewYandexLink || null,
        reactivationEnabled: data.reactivationEnabled ?? true,
        reactivationDays: data.reactivationDays ?? 30,
        reactivationDiscount: data.reactivationDiscount ?? 10,
      },
      create: {
        businessId: business.id,
        reminder24hEnabled: data.reminder24hEnabled ?? true,
        reminder2hEnabled: data.reminder2hEnabled ?? true,
        reviewEnabled: data.reviewEnabled ?? true,
        reviewDelayHours: data.reviewDelayHours ?? 2,
        reviewGoogleLink: data.reviewGoogleLink || null,
        review2gisLink: data.review2gisLink || null,
        reviewYandexLink: data.reviewYandexLink || null,
        reactivationEnabled: data.reactivationEnabled ?? true,
        reactivationDays: data.reactivationDays ?? 30,
        reactivationDiscount: data.reactivationDiscount ?? 10,
      },
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Save automation settings error:", error);
    return NextResponse.json(
      { error: "Ошибка сохранения" },
      { status: 500 }
    );
  }
}
