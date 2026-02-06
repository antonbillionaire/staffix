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

// GET - получить сотрудников
export async function GET() {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const staff = await prisma.staff.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Get staff error:", error);
    return NextResponse.json({ error: "Ошибка получения данных" }, { status: 500 });
  }
}

// POST - добавить сотрудника
export async function POST(request: Request) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const data = await request.json();
    const { name, role } = data;

    if (!name) {
      return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
    }

    const person = await prisma.staff.create({
      data: {
        name,
        role: role || null,
        businessId: business.id,
      },
    });

    return NextResponse.json({ staff: person });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json({ error: "Ошибка создания" }, { status: 500 });
  }
}
