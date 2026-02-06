import { NextResponse } from "next/server";
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
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: { businessId: business.id },
      include: {
        service: { select: { name: true, price: true, duration: true } },
        staff: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
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
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
