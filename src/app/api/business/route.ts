import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { auth } from "@/auth";

// GET - получить данные бизнеса текущего пользователя
export async function GET() {
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

    const business = await prisma.business.findFirst({
      where: { userId },
      include: {
        subscription: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error("Get business error:", error);
    return NextResponse.json(
      { error: "Ошибка получения данных" },
      { status: 500 }
    );
  }
}

// PUT - обновить данные бизнеса
export async function PUT(request: Request) {
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
    const { name, phone, address, workingHours, botToken } = data;

    // Найти бизнес пользователя
    const existingBusiness = await prisma.business.findFirst({
      where: { userId },
    });

    if (!existingBusiness) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    // Обновить данные
    const updatedBusiness = await prisma.business.update({
      where: { id: existingBusiness.id },
      data: {
        name: name || existingBusiness.name,
        phone: phone || existingBusiness.phone,
        address: address || existingBusiness.address,
        workingHours: workingHours || existingBusiness.workingHours,
        botToken: botToken || existingBusiness.botToken,
      },
    });

    return NextResponse.json({
      message: "Данные сохранены",
      business: updatedBusiness,
    });
  } catch (error) {
    console.error("Update business error:", error);
    return NextResponse.json(
      { error: "Ошибка сохранения данных" },
      { status: 500 }
    );
  }
}
