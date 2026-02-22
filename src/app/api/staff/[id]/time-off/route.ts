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

// GET — список отгулов мастера
export async function GET(
  _request: NextRequest,
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

    const timeOffs = await prisma.staffTimeOff.findMany({
      where: { staffId: id },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ timeOffs });
  } catch (error) {
    console.error("Get time-offs error:", error);
    return NextResponse.json({ error: "Ошибка получения данных" }, { status: 500 });
  }
}

// POST — добавить отгул/отпуск
export async function POST(
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

    const { startDate, endDate, reason, notes } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Укажите даты начала и окончания" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Некорректные даты" }, { status: 400 });
    }

    if (end < start) {
      return NextResponse.json({ error: "Дата окончания не может быть раньше начала" }, { status: 400 });
    }

    const timeOff = await prisma.staffTimeOff.create({
      data: {
        staffId: id,
        startDate: start,
        endDate: end,
        reason: reason || "vacation",
        notes: notes || null,
        createdBy: "owner",
      },
    });

    return NextResponse.json({ timeOff });
  } catch (error) {
    console.error("Create time-off error:", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
