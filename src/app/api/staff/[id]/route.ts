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

// PUT - обновить сотрудника
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
    const data = await request.json();
    const { name, role, photo } = data;

    const person = await prisma.staff.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });

    if (!person || person.business.userId !== userId) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    const updated = await prisma.staff.update({
      where: { id },
      data: {
        name: name || undefined,
        role: role !== undefined ? role : undefined,
        photo: photo !== undefined ? (photo || null) : undefined,
      },
    });

    return NextResponse.json({ staff: updated });
  } catch (error) {
    console.error("Update staff error:", error);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}

// DELETE - удалить сотрудника
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    const person = await prisma.staff.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });

    if (!person || person.business.userId !== userId) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    await prisma.staff.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete staff error:", error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
