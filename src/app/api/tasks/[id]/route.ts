import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["pending", "done", "cancelled"] as const;
const VALID_PRIORITIES = ["low", "normal", "high"] as const;

// PATCH /api/tasks/[id] — update fields of a task. Most common operations:
//   { status: "done" }                   — mark complete
//   { dueAt: "2026-05-05T15:00:00Z" }    — reschedule
//   { assignedStaffId: "staff-1" }       — reassign
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await prisma.task.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const updateData: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      const trimmed = body.title.trim();
      if (!trimmed || trimmed.length > 200) {
        return NextResponse.json({ error: "Название до 200 символов" }, { status: 400 });
      }
      updateData.title = trimmed;
    }
    if (body.description !== undefined) {
      updateData.description =
        typeof body.description === "string" ? body.description.trim().slice(0, 4000) || null : null;
    }
    if (body.priority !== undefined) {
      if (!(VALID_PRIORITIES as readonly string[]).includes(body.priority)) {
        return NextResponse.json({ error: "Недопустимый приоритет" }, { status: 400 });
      }
      updateData.priority = body.priority;
    }
    if (body.dueAt !== undefined) {
      if (body.dueAt === null) {
        updateData.dueAt = null;
      } else {
        const d = new Date(body.dueAt);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
        }
        updateData.dueAt = d;
      }
    }
    if (body.assignedStaffId !== undefined) {
      updateData.assignedStaffId = body.assignedStaffId || null;
    }
    if (body.status !== undefined) {
      if (!(VALID_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
      }
      updateData.status = body.status;
      // Stamp completion when transitioning out of pending; clear when going back.
      if (body.status === "pending") {
        updateData.completedAt = null;
        updateData.completedBy = null;
      } else if (existing.status === "pending") {
        updateData.completedAt = new Date();
        updateData.completedBy = session.user.id;
      }
    }

    const task = await prisma.task.update({ where: { id }, data: updateData });
    return NextResponse.json({ task });
  } catch (error) {
    console.error("Task PATCH error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await prisma.task.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Task DELETE error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
