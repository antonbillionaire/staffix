import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { auth } from "@/auth";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user?.id) return user.id;
  }
  const cookieStore = await cookies();
  return cookieStore.get("userId")?.value || null;
}

// GET - fetch bookings for current business
// Query params: startDate, endDate, staffId
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId },
      select: { id: true, timezone: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    // Parse query params for calendar filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const staffId = searchParams.get("staffId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: business.id };

    if (startDate && endDate) {
      // Extend range by 1 day on each side to account for timezone offset
      // (e.g. UTC+5: "2026-02-16" in business TZ = 2026-02-15T19:00Z in UTC)
      const gte = new Date(startDate + "T00:00:00Z");
      gte.setUTCDate(gte.getUTCDate() - 1);
      const lte = new Date(endDate + "T23:59:59.999Z");
      lte.setUTCDate(lte.getUTCDate() + 1);
      where.date = { gte, lte };
    }

    if (staffId) {
      where.staffId = staffId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: { select: { name: true, price: true, duration: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: startDate ? 500 : 100,
    });

    // Serialize BigInt clientTelegramId to string
    const serialized = bookings.map((b) => ({
      id: b.id,
      clientName: b.clientName,
      clientPhone: b.clientPhone,
      clientTelegramId: b.clientTelegramId?.toString() || null,
      date: b.date.toISOString(),
      status: b.status,
      serviceName: b.service?.name || null,
      servicePrice: b.service?.price || null,
      serviceDuration: b.service?.duration || null,
      staffId: b.staff?.id || null,
      staffName: b.staff?.name || null,
      createdAt: b.createdAt.toISOString(),
    }));

    // Stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const bookingsToday = bookings.filter(
      (b) => b.date >= todayStart && b.date < todayEnd && b.status !== "cancelled"
    ).length;

    const upcomingCount = bookings.filter(
      (b) => b.date >= now && b.status !== "cancelled"
    ).length;

    return NextResponse.json({
      bookings: serialized,
      stats: { bookingsToday, upcomingCount, total: bookings.length },
      timezone: business.timezone || "Asia/Tashkent",
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
