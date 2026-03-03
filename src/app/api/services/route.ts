import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Helper to get user ID
async function getUserId(): Promise<string | null> {
  // Try NextAuth session first
  const session = await auth();

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user?.id) return user.id;
  }

  return null;
}

// GET - получить услуги текущего бизнеса
export async function GET() {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    const services = await prisma.service.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ services });
  } catch (error) {
    console.error("Get services error:", error);
    return NextResponse.json(
      { error: "Ошибка получения данных" },
      { status: 500 }
    );
  }
}

// POST - создать новую услугу
export async function POST(request: Request) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    const data = await request.json();
    const { name, price, duration, description } = data;

    if (!name || !price || !duration) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      );
    }

    const parsedPrice = parseInt(price, 10);
    const parsedDuration = parseInt(duration, 10);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json(
        { error: "Некорректная цена" },
        { status: 400 }
      );
    }

    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return NextResponse.json(
        { error: "Некорректная длительность" },
        { status: 400 }
      );
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        price: parsedPrice,
        duration: parsedDuration,
        businessId: business.id,
      },
    });

    return NextResponse.json({ service });
  } catch (error) {
    console.error("Create service error:", error);
    return NextResponse.json(
      { error: "Ошибка создания услуги" },
      { status: 500 }
    );
  }
}
