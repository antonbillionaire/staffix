import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Period = "day" | "week" | "month" | "all";

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "day") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null; // all time
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    let userId: string | undefined;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId },
      include: {
        subscription: true,
        staff: { select: { id: true } },
        services: { select: { id: true } },
        products: { select: { id: true } },
        faqs: { select: { id: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "week") as Period;
    const periodStart = getPeriodStart(period);

    const dateFilter = periodStart ? { gte: periodStart } : undefined;

    const [bookings, orders, clients, messages] = await Promise.all([
      prisma.booking.count({
        where: {
          businessId: business.id,
          status: { not: "cancelled" },
          ...(dateFilter ? { date: dateFilter } : {}),
        },
      }),
      prisma.order.count({
        where: {
          businessId: business.id,
          status: { not: "cancelled" },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.client.count({
        where: {
          businessId: business.id,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      // Total messages used (from subscription, period filter not applicable here)
      Promise.resolve(business.subscription?.messagesUsed || 0),
    ]);

    // Channel status
    const channels = {
      telegram: !!business.botActive && !!business.botToken,
      whatsapp: false, // coming soon
      instagram: false, // coming soon
    };

    // Readiness checklist
    const readiness = {
      telegram: !!business.botActive && !!business.botToken,
      team: business.staff.length > 0,
      services: business.services.length > 0,
      products: business.products.length > 0,
      knowledge: business.faqs.length > 0,
    };

    return NextResponse.json({
      period,
      stats: { bookings, orders, clients, messages },
      channels,
      readiness,
      businessType: business.businessType || null,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Ошибка получения статистики" }, { status: 500 });
  }
}
