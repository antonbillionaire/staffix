import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

async function getUserId(): Promise<string | null> {
  const session = await auth();

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user?.id) return user.id;
  }

  return null;
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
    const { name, role, specialization, photo, telegramUsername, notificationsEnabled, baseRate, commissionPercent, acceptsLeads } = data;

    const person = await prisma.staff.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });

    if (!person || person.business.userId !== userId) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    // Если роль приходит — валидируем (только канонизированные значения)
    const VALID_ROLES = ["admin", "manager", "master", "doctor", "operator", "warehouse", "custom"];
    let normalizedRole: string | undefined = undefined;
    if (role !== undefined) {
      const trimmed = typeof role === "string" ? role.trim() : "";
      if (!trimmed || !VALID_ROLES.includes(trimmed)) {
        return NextResponse.json(
          { error: "Роль обязательна. Выберите одну из: admin, manager, master, doctor, operator, warehouse, custom" },
          { status: 400 }
        );
      }
      normalizedRole = trimmed;
    }

    const updated = await prisma.staff.update({
      where: { id },
      data: {
        name: name || undefined,
        role: normalizedRole,
        specialization: specialization !== undefined
          ? (typeof specialization === "string" && specialization.trim() ? specialization.trim() : null)
          : undefined,
        photo: photo !== undefined ? (photo || null) : undefined,
        telegramUsername: telegramUsername !== undefined ? (telegramUsername || null) : undefined,
        notificationsEnabled: notificationsEnabled !== undefined ? notificationsEnabled : undefined,
        baseRate: baseRate !== undefined ? (baseRate === null || baseRate === "" ? null : Math.round(Number(baseRate))) : undefined,
        commissionPercent: commissionPercent !== undefined ? (commissionPercent === null || commissionPercent === "" ? null : Number(commissionPercent)) : undefined,
        acceptsLeads: acceptsLeads !== undefined ? Boolean(acceptsLeads) : undefined,
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
