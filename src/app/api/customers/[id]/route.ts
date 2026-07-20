import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, businessId },
    });

    if (!client) {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }

    // Get conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        businessId,
        clientTelegramId: client.telegramId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: { select: { messages: true } },
      },
    });

    // Get bookings
    const bookings = await prisma.booking.findMany({
      where: {
        businessId,
        clientTelegramId: client.telegramId,
      },
      include: {
        service: true,
        staff: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get reviews
    const reviews = await prisma.review.findMany({
      where: {
        businessId,
        clientTelegramId: client.telegramId,
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hasRecentVisit = client.lastVisitDate
      ? new Date(client.lastVisitDate) > thirtyDaysAgo
      : false;
    const hasRecentMessages = client.lastMessageAt
      ? new Date(client.lastMessageAt) > thirtyDaysAgo
      : false;
    const isActive = hasRecentVisit || hasRecentMessages || bookings.length > 0;
    const isVip = client.totalVisits >= 5 || bookings.length >= 5;

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    // Calculate total spent
    const completedBookings = bookings.filter((b) => b.status === "completed");
    const totalSpent = completedBookings.reduce(
      (sum, b) => sum + (b.service?.price || 0),
      0
    );

    // Список сотрудников этого бизнеса — для дропдауна "Кому назначен".
    const staffList = await prisma.staff.findMany({
      where: { businessId },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      customer: {
        id: client.id,
        telegramId: client.telegramId.toString(),
        name: client.name || conversation?.clientName || "Клиент",
        phone: client.phone,
        totalVisits: client.totalVisits,
        lastVisitDate: client.lastVisitDate,
        isBlocked: client.isBlocked,
        botMuted: client.botMuted,
        importantNotes: client.importantNotes,
        createdAt: client.createdAt,
        assignedStaffId: client.assignedStaffId,
        // Computed
        isActive,
        isVip,
        segment: isVip ? "vip" : isActive ? "active" : "inactive",
        avgRating,
        totalSpent,
        customFields: (client.customFields as Record<string, string | number>) || {},
      },
      staffList,
      conversation: conversation
        ? {
            id: conversation.id,
            messagesCount: conversation._count.messages,
            messages: conversation.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
          }
        : null,
      bookings: bookings.map((b) => ({
        id: b.id,
        date: b.date,
        status: b.status,
        serviceName: b.service?.name,
        servicePrice: b.service?.price,
        staffName: b.staff?.name,
        createdAt: b.createdAt,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Customer detail error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Block/unblock customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();

    const client = await prisma.client.findFirst({
      where: { id, businessId },
    });

    if (!client) {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }

    // Validate input lengths
    const name = body.name ?? client.name;
    const phone = body.phone ?? client.phone;
    if (typeof name === "string" && name.length > 100) {
      return NextResponse.json({ error: "Name too long (max 100)" }, { status: 400 });
    }
    if (typeof phone === "string" && phone.length > 20) {
      return NextResponse.json({ error: "Phone too long (max 20)" }, { status: 400 });
    }

    // importantNotes — может прийти как пустая строка (очистить) или null (не менять)
    const importantNotesUpdate: { importantNotes?: string | null } = {};
    if (body.importantNotes !== undefined) {
      const notes = typeof body.importantNotes === "string" ? body.importantNotes.trim() : "";
      if (notes.length > 2000) {
        return NextResponse.json({ error: "Important notes too long (max 2000)" }, { status: 400 });
      }
      importantNotesUpdate.importantNotes = notes || null;
    }

    // customFields — мердж новых значений с существующими по конфигу.
    // Если клиент шлёт null/"" по конкретному ключу — поле очищается.
    const customFieldsUpdate: { customFields?: Record<string, unknown> } = {};
    if (body.customFields !== undefined && typeof body.customFields === "object" && body.customFields !== null) {
      // Подгружаем конфиг полей бизнеса, чтобы валидировать ключи и типы.
      const businessConfig = await prisma.business.findUnique({
        where: { id: businessId },
        select: { clientFieldsConfig: true },
      });
      const config = (businessConfig?.clientFieldsConfig as Array<{ key: string; type: string; options?: string[] }>) || [];
      const configByKey = new Map(config.map((f) => [f.key, f]));
      const existing = (client.customFields as Record<string, unknown>) || {};
      const merged: Record<string, unknown> = { ...existing };

      for (const [k, v] of Object.entries(body.customFields as Record<string, unknown>)) {
        const def = configByKey.get(k);
        if (!def) continue; // ключ не описан в конфиге — игнорируем
        if (v === null || v === "") {
          delete merged[k];
          continue;
        }
        if (def.type === "number") {
          const n = Number(v);
          if (!Number.isFinite(n)) {
            return NextResponse.json({ error: `Поле "${def.key}": ожидается число` }, { status: 400 });
          }
          merged[k] = n;
        } else if (def.type === "date") {
          const d = new Date(String(v));
          if (Number.isNaN(d.getTime())) {
            return NextResponse.json({ error: `Поле "${def.key}": неверная дата` }, { status: 400 });
          }
          merged[k] = d.toISOString().slice(0, 10); // храним как YYYY-MM-DD
        } else if (def.type === "select") {
          const str = String(v);
          if (def.options && !def.options.includes(str)) {
            return NextResponse.json({ error: `Поле "${def.key}": значение не из списка` }, { status: 400 });
          }
          merged[k] = str;
        } else {
          // text
          const str = String(v).slice(0, 1000);
          merged[k] = str;
        }
      }
      customFieldsUpdate.customFields = merged;
    }

    // assignedStaffId — ручное переназначение клиента менеджеру.
    // null/"" → отвязать. Для непустого id проверяем что staff из этого бизнеса.
    const assignedStaffUpdate: { assignedStaffId?: string | null } = {};
    if (body.assignedStaffId !== undefined) {
      if (body.assignedStaffId === null || body.assignedStaffId === "") {
        assignedStaffUpdate.assignedStaffId = null;
      } else {
        const staff = await prisma.staff.findFirst({
          where: { id: body.assignedStaffId, businessId },
          select: { id: true },
        });
        if (!staff) {
          return NextResponse.json({ error: "Сотрудник не найден" }, { status: 400 });
        }
        assignedStaffUpdate.assignedStaffId = staff.id;
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        isBlocked: body.isBlocked ?? client.isBlocked,
        botMuted: body.botMuted ?? client.botMuted,
        name,
        phone,
        ...importantNotesUpdate,
        ...assignedStaffUpdate,
        // Prisma JsonValue типизация не дружит с Record<string, unknown> —
        // прокидываем через unknown.
        ...(customFieldsUpdate.customFields !== undefined
          ? { customFields: customFieldsUpdate.customFields as unknown as object }
          : {}),
      },
    });

    return NextResponse.json({ customer: updatedClient });
  } catch (error) {
    console.error("Customer update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
