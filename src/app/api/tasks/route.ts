import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

const VALID_STATUSES = ["pending", "done", "cancelled"] as const;
const VALID_PRIORITIES = ["low", "normal", "high"] as const;

// GET /api/tasks?status=pending&assignedStaffId=...&dueBy=today
//
// Returns tasks for the current user's business. Default: pending tasks
// sorted by dueAt asc (overdue first), then by priority (high → low).
export async function GET(request: NextRequest) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const assignedStaffId = searchParams.get("assignedStaffId");
    const dueBy = searchParams.get("dueBy"); // "today" | "week" | undefined
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);

    const where: Record<string, unknown> = { businessId };
    if (status !== "all") {
      if (!(VALID_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
      }
      where.status = status;
    }
    if (assignedStaffId) where.assignedStaffId = assignedStaffId;
    if (dueBy === "today") {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      where.dueAt = { lte: end };
    } else if (dueBy === "week") {
      const end = new Date();
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);
      where.dueAt = { lte: end };
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        // Without nullsFirst Postgres puts nulls last by default — keep that
        // (tasks without dueAt go to the bottom).
        { dueAt: "asc" },
        { priority: "desc" }, // "high" > "normal" > "low" alphabetically — works
        { createdAt: "asc" },
      ],
      take: limit,
    });

    // Hydrate client/staff names — light, only for the page we return.
    const clientIds = Array.from(new Set(tasks.map((t) => t.clientId).filter(Boolean) as string[]));
    const staffIds = Array.from(new Set(tasks.map((t) => t.assignedStaffId).filter(Boolean) as string[]));
    const [clients, staff] = await Promise.all([
      clientIds.length
        ? prisma.client.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, name: true, phone: true, telegramUsername: true },
          })
        : Promise.resolve([]),
      staffIds.length
        ? prisma.staff.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const staffMap = new Map(staff.map((s) => [s.id, s]));

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        ...t,
        client: t.clientId ? clientMap.get(t.clientId) ?? null : null,
        assignedStaff: t.assignedStaffId ? staffMap.get(t.assignedStaffId) ?? null : null,
      })),
    });
  } catch (error) {
    console.error("Tasks GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST /api/tasks — create a manual task.
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) {
      return NextResponse.json({ error: "Название обязательно (до 200 символов)" }, { status: 400 });
    }
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 4000) : null;
    const priority = (VALID_PRIORITIES as readonly string[]).includes(body.priority) ? body.priority : "normal";
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }

    const assignedStaffId = body.assignedStaffId || null;
    if (assignedStaffId) {
      const staffExists = await prisma.staff.findFirst({
        where: { id: assignedStaffId, businessId: business.id },
        select: { id: true },
      });
      if (!staffExists) {
        return NextResponse.json({ error: "Сотрудник не найден" }, { status: 400 });
      }
    }

    const clientId = body.clientId || null;
    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: { id: clientId, businessId: business.id },
        select: { id: true },
      });
      if (!clientExists) {
        return NextResponse.json({ error: "Клиент не найден" }, { status: 400 });
      }
    }

    const task = await prisma.task.create({
      data: {
        businessId: business.id,
        title,
        description: description || null,
        priority,
        dueAt,
        assignedStaffId,
        clientId,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Tasks POST error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
