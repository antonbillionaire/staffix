import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Только администратор может менять режим" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const business = await prisma.business.findFirst({ where: { userId: user.id } });
    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const { mode } = await request.json();
    if (mode !== "service" && mode !== "sales") {
      return NextResponse.json({ error: "Режим должен быть 'service' или 'sales'" }, { status: 400 });
    }

    await prisma.business.update({
      where: { id: business.id },
      data: { dashboardMode: mode },
    });

    return NextResponse.json({ ok: true, dashboardMode: mode });
  } catch (error) {
    console.error("Dashboard mode switch error:", error);
    return NextResponse.json({ error: "Ошибка переключения режима" }, { status: 500 });
  }
}
