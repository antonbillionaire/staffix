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

    // Sprint 3: Client.telegramId стал nullable для WA/IG/FB клиентов.
    // Диалоги/бронирования/отзывы связаны по clientTelegramId (BigInt) — ищем
    // только когда TG-идентичность есть. Для channel-only клиентов эти
    // разделы пусты (будут наполнены после ChannelClient→Client backfill).
    const tgId = client.telegramId;

    // Get TG conversation
    const conversation = tgId
      ? await prisma.conversation.findFirst({
          where: {
            businessId,
            clientTelegramId: tgId,
          },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 50,
            },
            _count: { select: { messages: true } },
          },
        })
      : null;

    // Sprint 4B: ChannelConversation'ы этого же клиента (WA/IG/FB).
    // Раньше карточка показывала «0 сообщений» для чисто-канальных клиентов
    // и обрезала историю у клиентов с несколькими каналами. Теперь суммируем
    // messageCount со всех каналов, куда клиент писал, и мержим их сообщения
    // в общий поток для отображения.
    const channelIdMatchers: Array<{ channel: string; clientId: string }> = [];
    if (client.whatsappId) channelIdMatchers.push({ channel: "whatsapp", clientId: client.whatsappId });
    if (client.instagramId) channelIdMatchers.push({ channel: "instagram", clientId: client.instagramId });
    if (client.fbPsid) channelIdMatchers.push({ channel: "facebook", clientId: client.fbPsid });

    const channelConversations = channelIdMatchers.length > 0
      ? await prisma.channelConversation.findMany({
          where: {
            businessId,
            OR: channelIdMatchers,
          },
          select: {
            id: true,
            channel: true,
            messageCount: true,
            history: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        })
      : [];

    // Get bookings
    const bookings = tgId
      ? await prisma.booking.findMany({
          where: {
            businessId,
            clientTelegramId: tgId,
          },
          include: {
            service: true,
            staff: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [];

    // Get reviews
    const reviews = tgId
      ? await prisma.review.findMany({
          where: {
            businessId,
            clientTelegramId: tgId,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

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

    // Sprint 4B: суммарный счётчик сообщений TG + WA/IG/FB.
    // Плюс вмерженный поток последних сообщений для отображения в карточке.
    interface HistoryEntry { role?: string; content?: string; createdAt?: string | number }
    type MsgRow = { id: string; role: string; content: string; createdAt: string };

    const channelMessagesCount = channelConversations.reduce(
      (sum, c) => sum + (c.messageCount || 0),
      0
    );
    const combinedMessagesCount =
      (conversation?._count.messages || 0) + channelMessagesCount;

    const tgMessagesList: MsgRow[] = (conversation?.messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    // history — JSON [{role, content, createdAt?}]. createdAt не всегда есть,
    // тогда используем updatedAt беседы как якорь (лучше чем ничего).
    const channelMessagesList: MsgRow[] = [];
    channelConversations.forEach((c) => {
      const hist = Array.isArray(c.history) ? (c.history as HistoryEntry[]) : [];
      hist.forEach((h, idx) => {
        if (!h || typeof h !== "object" || !h.content) return;
        const at = h.createdAt
          ? new Date(h.createdAt).toISOString()
          : c.updatedAt.toISOString();
        channelMessagesList.push({
          id: `${c.id}:${idx}`,
          role: h.role || "user",
          content: String(h.content),
          createdAt: at,
        });
      });
    });

    const combinedMessages = [...tgMessagesList, ...channelMessagesList]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return NextResponse.json({
      customer: {
        id: client.id,
        telegramId: client.telegramId?.toString() ?? null,
        whatsappId: client.whatsappId ?? null,
        instagramId: client.instagramId ?? null,
        fbPsid: client.fbPsid ?? null,
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
      // Sprint 4B: conversation теперь агрегирует TG + WA/IG/FB. id = tg-conversation
      // id (для legacy-ссылок) или id первой канальной беседы если TG нет.
      // messagesCount = TG + сумма messageCount со всех каналов. messages —
      // сортированный merge последних 50 сообщений из всех источников.
      conversation: (conversation || channelConversations.length > 0)
        ? {
            id: conversation?.id || channelConversations[0]?.id || client.id,
            messagesCount: combinedMessagesCount,
            messages: combinedMessages,
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
