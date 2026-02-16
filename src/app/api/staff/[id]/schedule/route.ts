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

// GET - получить расписание мастера
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    const staff = await prisma.staff.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });

    if (!staff || staff.business.userId !== userId) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    const schedule = await prisma.staffSchedule.findMany({
      where: { staffId: id },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("Get schedule error:", error);
    return NextResponse.json({ error: "Ошибка получения расписания" }, { status: 500 });
  }
}

// PUT - сохранить расписание мастера (7 дней)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    const staff = await prisma.staff.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });

    if (!staff || staff.business.userId !== userId) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    const { schedule } = await request.json();

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return NextResponse.json({ error: "Расписание обязательно" }, { status: 400 });
    }

    // Upsert each day
    const results = await Promise.all(
      schedule.map((day: { dayOfWeek: number; startTime: string; endTime: string; isWorkday: boolean }) =>
        prisma.staffSchedule.upsert({
          where: {
            staffId_dayOfWeek: {
              staffId: id,
              dayOfWeek: day.dayOfWeek,
            },
          },
          create: {
            staffId: id,
            dayOfWeek: day.dayOfWeek,
            startTime: day.startTime,
            endTime: day.endTime,
            isWorkday: day.isWorkday,
          },
          update: {
            startTime: day.startTime,
            endTime: day.endTime,
            isWorkday: day.isWorkday,
          },
        })
      )
    );

    return NextResponse.json({ schedule: results });
  } catch (error) {
    console.error("Update schedule error:", error);
    return NextResponse.json({ error: "Ошибка сохранения расписания" }, { status: 500 });
  }
}
