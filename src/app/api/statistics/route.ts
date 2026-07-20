import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "week";

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let prevStartDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
        prevStartDate = new Date(0);
    }

    // Find user's business
    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({
        totalMessages: 0,
        totalBookings: 0,
        totalClients: 0,
        avgResponseTime: 0,
        conversionRate: 0,
        popularQuestions: [],
        messagesByDay: [],
      });
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ========= PARALLEL BATCH: All independent queries =========
    //
    // ВАЖНО про мульти-канальность: для каждого «универсального» показателя
    // (сообщения, клиенты, дни активности, частые вопросы) запрашиваем
    // обе таблицы: Message (Telegram) и ChannelMessage (WhatsApp / Instagram
    // / Facebook). Раньше считалось только TG — для бизнесов на других
    // каналах вся страница «Моя статистика» показывала нули. Аналогично
    // для клиентов: Client (TG) + ChannelClient (WA/IG/FB).
    const [
      // Core stats (Telegram)
      tgTotalMessages,
      totalBookings,
      tgConversations,
      tgMessages,
      tgUserMessages,
      clients,
      bookingStatusCounts,
      completedBookings,
      broadcastsSent,
      reviews,
      // Core stats (Channel — WA/IG/FB)
      channelConversationsInPeriod,
      channelClients,
      channelUniqueClientsRows,
      // Previous period (for trends)
      prevTgMessages,
      prevChannelMessageCountAgg,
      prevBookings,
      prevTgConversations,
      prevChannelUniqueClientsRows,
      prevOrders,
      // Order stats
      totalOrders,
      orderStatusCounts,
      orderRevenueAgg,
      ordersList,
      orderItems,
      // Channel & response time
      channelMessageCounts,
      recentConversations,
      // Лиды, которые бот эскалировал владельцу (notify_manager tool creates
      // Notification with type=manager_escalation). Это метрика «лидов
      // переданных ботом», которую Anton хотел видеть в дашборде — Right Flight
      // ощущал что реально приходит ~50 лидов, но в стате их не было видно.
      leadsEscalatedTotal,
      leadsEscalatedPrev,
    ] = await Promise.all([
      // --- Telegram-side core stats ---
      prisma.message.count({
        where: {
          conversation: { businessId: business.id },
          createdAt: { gte: startDate },
        },
      }),
      prisma.booking.count({
        where: {
          businessId: business.id,
          createdAt: { gte: startDate },
        },
      }),
      prisma.conversation.findMany({
        where: {
          businessId: business.id,
          createdAt: { gte: startDate },
        },
        select: { clientTelegramId: true },
        distinct: ["clientTelegramId"],
      }),
      prisma.message.findMany({
        where: {
          conversation: { businessId: business.id },
          createdAt: { gte: startDate },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.message.findMany({
        where: {
          conversation: { businessId: business.id },
          role: "user",
          createdAt: { gte: startDate },
        },
        select: { content: true },
      }),
      prisma.client.findMany({
        where: { businessId: business.id },
        select: { totalVisits: true, lastVisitDate: true },
      }),
      prisma.booking.groupBy({
        by: ["status"],
        where: { businessId: business.id, createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.booking.findMany({
        where: {
          businessId: business.id,
          status: "completed",
          createdAt: { gte: startDate },
        },
        include: { service: { select: { price: true } } },
      }),
      prisma.clientBroadcast.count({
        where: {
          businessId: business.id,
          status: "sent",
          createdAt: { gte: startDate },
        },
      }),
      prisma.review.findMany({
        where: { businessId: business.id, createdAt: { gte: startDate } },
        select: { rating: true },
      }),
      // --- Channel-side core stats (WA / IG / FB) ---
      //
      // ВАЖНО: ChannelMessage табличка существует в схеме, но прод-код
      // в неё НИКОГДА не пишет. Сообщения каналов лежат как JSON-массив
      // в ChannelConversation.history + счётчик ChannelConversation.messageCount.
      // Поэтому все запросы тут идут к ChannelConversation, а не ChannelMessage.
      //
      // Минус: history JSON не хранит per-message createdAt. Для серии
      // «сообщений по дням» используем conversation.updatedAt как точку,
      // в которую кладём весь messageCount беседы. Это даёт правильную
      // СУММУ по периоду, но точность распределения по дням приблизительная
      // — все сообщения долгой беседы концентрируются на последнем активном
      // дне. Для коротких бесед (типичный кейс новых клиентов) это норм.
      prisma.channelConversation.findMany({
        where: { businessId: business.id, updatedAt: { gte: startDate } },
        select: { updatedAt: true, messageCount: true, history: true, channel: true },
      }),
      // Все клиенты в каналах WA/IG/FB (для подсчёта общей базы)
      prisma.channelClient.count({
        where: { businessId: business.id },
      }),
      // Уникальные клиенты текущего периода (по conversation)
      prisma.channelConversation.findMany({
        where: {
          businessId: business.id,
          updatedAt: { gte: startDate },
        },
        select: { channel: true, clientId: true },
      }),
      // --- Previous period (for trends) ---
      period !== "all" ? prisma.message.count({
        where: {
          conversation: { businessId: business.id },
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }) : Promise.resolve(0),
      // Prev-period сумма channel сообщений: aggregate sum of messageCount
      // over conversations updated в прошлом периоде. Та же оговорка про
      // точность что выше — для тренд-стрелок «в норму».
      period !== "all" ? prisma.channelConversation.aggregate({
        where: {
          businessId: business.id,
          updatedAt: { gte: prevStartDate, lt: startDate },
        },
        _sum: { messageCount: true },
      }) : Promise.resolve({ _sum: { messageCount: 0 } }),
      period !== "all" ? prisma.booking.count({
        where: {
          businessId: business.id,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }) : Promise.resolve(0),
      period !== "all" ? prisma.conversation.findMany({
        where: {
          businessId: business.id,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
        select: { clientTelegramId: true },
        distinct: ["clientTelegramId"],
      }) : Promise.resolve([]),
      period !== "all" ? prisma.channelConversation.findMany({
        where: {
          businessId: business.id,
          updatedAt: { gte: prevStartDate, lt: startDate },
        },
        select: { channel: true, clientId: true },
      }) : Promise.resolve([]),
      period !== "all" ? prisma.order.count({
        where: {
          businessId: business.id,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }) : Promise.resolve(0),
      // --- Order stats ---
      prisma.order.count({
        where: { businessId: business.id, createdAt: { gte: startDate } },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { businessId: business.id, createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { businessId: business.id, createdAt: { gte: startDate } },
        _sum: { totalPrice: true },
        _avg: { totalPrice: true },
      }),
      prisma.order.findMany({
        where: { businessId: business.id, createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.orderItem.findMany({
        where: {
          order: { businessId: business.id, createdAt: { gte: startDate } },
        },
        select: { name: true, quantity: true, price: true },
      }),
      // --- Channel breakdown & response time ---
      // Разбивка по каналам: суммируем messageCount по каждому каналу из
      // ChannelConversation. Раньше это была groupBy ChannelMessage, но
      // ChannelMessage никто не пишет, поэтому блок «сообщения по каналам»
      // на странице всегда был пустым (даже не показывался) у всех.
      prisma.channelConversation.groupBy({
        by: ["channel"],
        where: { businessId: business.id, updatedAt: { gte: startDate } },
        _sum: { messageCount: true },
      }),
      prisma.conversation.findMany({
        where: { businessId: business.id },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 100,
            where: { createdAt: { gte: startDate } },
          },
        },
        take: 20,
      }),
      // Лиды-эскалации в текущем периоде
      prisma.notification.count({
        where: {
          businessId: business.id,
          type: "manager_escalation",
          createdAt: { gte: startDate },
        },
      }),
      // Лиды-эскалации в предыдущем периоде (для тренда %)
      period !== "all" ? prisma.notification.count({
        where: {
          businessId: business.id,
          type: "manager_escalation",
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }) : Promise.resolve(0),
    ]);

    // ========= Process results (pure computation, no DB) =========

    // Объединённый счётчик сообщений = TG-Message + сумма messageCount
    // всех ChannelConversation'ов активных в периоде.
    const channelTotalMessages = channelConversationsInPeriod.reduce(
      (sum, conv) => sum + (conv.messageCount || 0),
      0
    );
    const totalMessages = tgTotalMessages + channelTotalMessages;

    // Уникальные клиенты периода: TG-телеграм-id плюс ChannelConversation
    // (channel + clientId) которые ещё не дублируются.
    const channelClientKeys = new Set(
      channelUniqueClientsRows.map((c) => `${c.channel}:${c.clientId}`)
    );
    const totalClients = tgConversations.length + channelClientKeys.size;

    // Calculate conversion rate
    const conversionRate = totalClients > 0
      ? Math.round((totalBookings / totalClients) * 100)
      : 0;

    // Group messages by day — TG + Channel объединяем в одну серию.
    // TG-сторона: 1 inkrement per message (точно).
    // Channel-сторона: history JSON без per-message timestamps, поэтому
    // весь messageCount беседы кладём в её updatedAt. Сумма по периоду
    // правильная, но распределение по дням — приблизительное (длинная
    // беседа сконцентрируется в последний активный день).
    const messagesByDayMap = new Map<string, number>();
    const addToDay = (d: Date, n: number) => {
      const dateStr = d.toISOString().split("T")[0];
      messagesByDayMap.set(dateStr, (messagesByDayMap.get(dateStr) || 0) + n);
    };
    tgMessages.forEach((msg) => addToDay(msg.createdAt, 1));
    channelConversationsInPeriod.forEach((conv) =>
      addToDay(conv.updatedAt, conv.messageCount || 0)
    );

    // Show appropriate number of days based on period, zero-fill missing days
    const maxDays = period === "week" ? 7 : period === "month" ? 30 : 90;
    const messagesByDay: { date: string; count: number }[] = [];
    if (period !== "all") {
      // Fill all days in the range with 0s, then overlay actual data
      for (let i = maxDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        messagesByDay.push({ date: dateStr, count: messagesByDayMap.get(dateStr) || 0 });
      }
    } else {
      // "All time" — just show days that have data
      const entries = Array.from(messagesByDayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .slice(-maxDays);
      messagesByDay.push(...entries);
    }

    // Keyword-based grouping: normalize messages and group similar ones.
    // Берём входящие со всех каналов: Message.role=user (TG) +
    // ChannelConversation.history JSON где role=user (WA/IG/FB).
    type HistoryEntry = { role?: string; content?: string };
    const channelUserContents: string[] = [];
    for (const conv of channelConversationsInPeriod) {
      // history хранится как Json — после Prisma это unknown, нужно
      // защититься на случай мусорных данных
      const history = Array.isArray(conv.history)
        ? (conv.history as HistoryEntry[])
        : [];
      for (const m of history) {
        if (m && typeof m === "object" && m.role === "user" && typeof m.content === "string") {
          channelUserContents.push(m.content);
        }
      }
    }
    const allIncomingTexts: string[] = [
      ...tgUserMessages.map((m) => m.content),
      ...channelUserContents,
    ];
    const questionCounts = new Map<string, { display: string; count: number }>();
    allIncomingTexts.forEach((rawText) => {
      const text = (rawText || "").trim();
      if (text.length < 3) return; // Skip very short messages like "Да", "Ок"

      // Normalize: lowercase, remove punctuation, collapse whitespace
      const normalized = text.toLowerCase()
        .replace(/[.,!?;:()"\-—–…]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 80);

      if (!normalized) return;

      const existing = questionCounts.get(normalized);
      if (existing) {
        existing.count++;
      } else {
        // Keep original text as display, truncated
        const display = text.length > 60 ? text.substring(0, 60) + "..." : text;
        questionCounts.set(normalized, { display, count: 1 });
      }
    });

    const popularQuestions = Array.from(questionCounts.values())
      .filter((q) => q.count >= 2) // Only show questions asked at least twice
      .map(({ display, count }) => ({ question: display, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // If no repeated questions, show top single ones
    if (popularQuestions.length === 0) {
      const topSingle = Array.from(questionCounts.values())
        .map(({ display, count }) => ({ question: display, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      popularQuestions.push(...topSingle);
    }

    // Customer segments
    const customerSegments = {
      vip: clients.filter((c) => c.totalVisits >= 5).length,
      active: clients.filter(
        (c) => c.totalVisits < 5 && c.lastVisitDate && new Date(c.lastVisitDate) > thirtyDaysAgo
      ).length,
      inactive: clients.filter(
        (c) => !c.lastVisitDate || new Date(c.lastVisitDate) <= thirtyDaysAgo
      ).length,
    };

    // Deal pipeline funnel — group clients by dealStage. Period filter is
    // applied via createdAt for the same window as the rest of statistics so
    // numbers line up; "all" shows lifetime totals.
    const stageGroups = await prisma.client.groupBy({
      by: ["dealStage"],
      where: {
        businessId: business.id,
        ...(period !== "all" ? { createdAt: { gte: startDate } } : {}),
      },
      _count: { _all: true },
    });
    const stageCounts: Record<string, number> = {
      lead: 0,
      consultation_booked: 0,
      consultation_done: 0,
      client: 0,
      lost: 0,
    };
    for (const g of stageGroups) {
      if (g.dealStage in stageCounts) {
        stageCounts[g.dealStage] = g._count._all;
      }
    }
    // Sum of revenue closed in the period (only "client" stage with dealValue).
    const closedDealsAgg = await prisma.client.aggregate({
      where: {
        businessId: business.id,
        dealStage: "client",
        dealValue: { not: null },
        ...(period !== "all" ? { dealClosedAt: { gte: startDate } } : {}),
      },
      _sum: { dealValue: true },
      _count: { _all: true },
    });
    // Total at the top of the funnel = anyone who entered (sum of all stages).
    const funnelTotal = Object.values(stageCounts).reduce((a, b) => a + b, 0);
    // Reaching at least stage X = sum of that stage AND every stage that
    // comes after it (excluding "lost" which is a fallout terminal state).
    const reachedConsultationBooked = stageCounts.consultation_booked + stageCounts.consultation_done + stageCounts.client;
    const reachedConsultationDone = stageCounts.consultation_done + stageCounts.client;
    const reachedClient = stageCounts.client;
    const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 1000) / 10 : 0);
    const dealFunnel = {
      counts: stageCounts,
      total: funnelTotal,
      revenue: closedDealsAgg._sum.dealValue ?? 0,
      closedDeals: closedDealsAgg._count._all,
      conversion: {
        leadToBooked: pct(reachedConsultationBooked, funnelTotal),
        bookedToDone: pct(reachedConsultationDone, reachedConsultationBooked),
        doneToClient: pct(reachedClient, reachedConsultationDone),
        leadToClient: pct(reachedClient, funnelTotal),
      },
    };

    // Bookings by status
    const bookingsByStatus = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    bookingStatusCounts.forEach((item) => {
      if (item.status in bookingsByStatus) {
        bookingsByStatus[item.status as keyof typeof bookingsByStatus] = item._count;
      }
    });

    // Total revenue from completed bookings
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);

    // Average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    // Trends
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Order stats processing
    const ordersByStatus: Record<string, number> = {};
    orderStatusCounts.forEach((item) => {
      ordersByStatus[item.status] = item._count;
    });

    const orderRevenue = orderRevenueAgg._sum?.totalPrice || 0;
    const avgOrderValue = Math.round(orderRevenueAgg._avg?.totalPrice || 0);

    // Orders by day
    const ordersByDayMap = new Map<string, number>();
    ordersList.forEach((o) => {
      const dateStr = o.createdAt.toISOString().split("T")[0];
      ordersByDayMap.set(dateStr, (ordersByDayMap.get(dateStr) || 0) + 1);
    });
    const ordersByDay = Array.from(ordersByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .slice(-maxDays);

    // Popular products (top items in orders)
    const productPopularity = new Map<string, { count: number; revenue: number }>();
    orderItems.forEach((item) => {
      const existing = productPopularity.get(item.name) || { count: 0, revenue: 0 };
      existing.count += item.quantity;
      existing.revenue += item.price * item.quantity;
      productPopularity.set(item.name, existing);
    });
    const popularProducts = Array.from(productPopularity.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Channel-specific message counts (для блока «Разбивка по каналам»).
    // Берём сумму messageCount по каждому каналу. Если у бизнеса есть и
    // TG-бот (через таблицу Message), добавляем туда tgTotalMessages как
    // отдельную строку telegram — иначе на странице TG не показывается.
    const messagesByChannel: Record<string, number> = {};
    channelMessageCounts.forEach((item) => {
      messagesByChannel[item.channel] = item._sum.messageCount || 0;
    });
    if (tgTotalMessages > 0) {
      messagesByChannel.telegram = (messagesByChannel.telegram || 0) + tgTotalMessages;
    }

    // Calculate average response time from message pairs
    let totalResponseMs = 0;
    let responseCount = 0;
    for (const conv of recentConversations) {
      for (let i = 1; i < conv.messages.length; i++) {
        if (conv.messages[i].role === "assistant" && conv.messages[i - 1].role === "user") {
          const diff = new Date(conv.messages[i].createdAt).getTime() - new Date(conv.messages[i - 1].createdAt).getTime();
          if (diff > 0 && diff < 300000) { // less than 5 minutes
            totalResponseMs += diff;
            responseCount++;
          }
        }
      }
    }
    const avgResponseTime = responseCount > 0
      ? Math.round(totalResponseMs / responseCount / 1000) // seconds
      : 0;

    // Conversion rate depends on business mode
    const isSalesMode = business.dashboardMode === "sales";
    const conversionRateAdjusted = isSalesMode
      ? (totalClients > 0 ? Math.round((totalOrders / totalClients) * 100) : 0)
      : conversionRate;

    // База клиентов — это все клиенты всех каналов. Раньше тут стоял
    // fallback `clients.length || totalClients`, и для бизнесов без TG
    // (только IG/WA/FB) показывало 0. Теперь складываем явно: Client (TG)
    // + ChannelClient (WA/IG/FB).
    const totalClientsCombined = clients.length + channelClients;

    // Trends: для сообщений и клиентов предыдущего периода тоже объединяем
    // оба источника.
    const prevChannelMessages = prevChannelMessageCountAgg._sum.messageCount || 0;
    const prevMessagesCombined = prevTgMessages + prevChannelMessages;
    const prevChannelClientKeys = new Set(
      prevChannelUniqueClientsRows.map((c) => `${c.channel}:${c.clientId}`)
    );
    const prevClientsCombined =
      prevTgConversations.length + prevChannelClientKeys.size;

    // ═══════════════════════════════════════════════════════════════════
    // NEW METRICS (июль 2026, по запросу Антона):
    //   - messagesByHour: загруженность по часам (24 корзины)
    //   - topConversations: топ 20 самых «болтливых» диалогов
    //   - heavyConversationsCount: сколько диалогов превысили порог
    //   - leadsByChannel: разбивка эскалаций по каналам
    // ═══════════════════════════════════════════════════════════════════

    const HEAVY_CONV_THRESHOLD = 30; // сообщений в одном диалоге → диалог «тяжёлый»

    // Хелпер: часовое ведро в timezone бизнеса. По умолчанию Asia/Tashkent
    // (основной рынок CIS), но берём Business.timezone если владелец выставил.
    const businessTz = (business as { timezone?: string | null }).timezone || "Asia/Tashkent";
    const getHourInTz = (date: Date): number => {
      try {
        const hourStr = date.toLocaleString("en-US", {
          timeZone: businessTz,
          hour: "2-digit",
          hour12: false,
        });
        const h = parseInt(hourStr, 10);
        return Number.isFinite(h) && h >= 0 && h < 24 ? h : date.getUTCHours();
      } catch {
        return date.getUTCHours();
      }
    };

    // messagesByHour — 24 корзины по часам в timezone бизнеса.
    // TG: считаем каждое Message.createdAt (точно).
    // Channel: используем conv.updatedAt (приближение — все сообщения диалога
    // «падают» на час последней активности; лучше чем ничего пока history
    // не хранит per-message timestamps).
    const messagesByHourMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) messagesByHourMap.set(h, 0);
    tgMessages.forEach((msg) => {
      const h = getHourInTz(msg.createdAt);
      messagesByHourMap.set(h, (messagesByHourMap.get(h) || 0) + 1);
    });
    channelConversationsInPeriod.forEach((conv) => {
      const h = getHourInTz(conv.updatedAt);
      messagesByHourMap.set(h, (messagesByHourMap.get(h) || 0) + (conv.messageCount || 0));
    });
    const messagesByHour = Array.from(messagesByHourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    // topConversations — топ 20 самых «болтливых» диалогов по messageCount.
    // Полезно чтобы владелец видел где бот тратит много сообщений (частый
    // повод для проверки: возможно бот застрял в цикле или клиент вопросы
    // задаёт которые бот не может закрыть).
    // TG Conversation НЕ имеет прямой FK на Client — только по clientTelegramId.
    // Достаём conversations + подсчёт сообщений, потом клиентов отдельно
    // одним batch-запросом (in-clause по telegramId).
    const [tgConvsRaw, chTopConvs] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          businessId: business.id,
          updatedAt: { gte: startDate },
        },
        include: {
          messages: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 60, // берём чуть больше чем нужно, после count-sort режем
      }),
      prisma.channelConversation.findMany({
        where: {
          businessId: business.id,
          updatedAt: { gte: startDate },
        },
        select: {
          id: true,
          channel: true,
          clientName: true,
          clientId: true,
          messageCount: true,
          updatedAt: true,
        },
        orderBy: { messageCount: "desc" },
        take: 40,
      }),
    ]);

    // Batch: имена клиентов по telegramId (одним запросом)
    const tgClientIds = tgConvsRaw.map((c) => c.clientTelegramId);
    const tgClientsById = new Map<string, { name: string | null; phone: string | null }>();
    if (tgClientIds.length > 0) {
      const clientsWithInfo = await prisma.client.findMany({
        where: {
          businessId: business.id,
          telegramId: { in: tgClientIds },
        },
        select: { telegramId: true, name: true, phone: true },
      });
      for (const c of clientsWithInfo) {
        if (!c.telegramId) continue; // Sprint 3: nullable telegramId — non-TG клиенты пропускаются в TG-map
        tgClientsById.set(c.telegramId.toString(), { name: c.name, phone: c.phone });
      }
    }

    const combinedTopConvs = [
      ...tgConvsRaw.map((c) => {
        const info = tgClientsById.get(c.clientTelegramId.toString());
        return {
          id: c.id,
          clientName:
            (c.clientName as string | null) ||
            info?.name ||
            `TG …${c.clientTelegramId.toString().slice(-4)}`,
          clientPhone: info?.phone || null,
          channel: "telegram",
          messageCount: c.messages.length,
          lastActivityAt: c.updatedAt.toISOString(),
        };
      }),
      ...chTopConvs.map((c) => ({
        id: c.id,
        clientName: c.clientName || `${c.channel} …${(c.clientId || "").slice(-4)}`,
        clientPhone: null as string | null,
        channel: c.channel,
        messageCount: c.messageCount || 0,
        lastActivityAt: c.updatedAt.toISOString(),
      })),
    ]
      .filter((c) => c.messageCount > 0)
      .sort((a, b) => b.messageCount - a.messageCount);

    const topConversations = combinedTopConvs.slice(0, 20);
    const heavyConversationsCount = combinedTopConvs.filter(
      (c) => c.messageCount >= HEAVY_CONV_THRESHOLD
    ).length;

    // leadsByChannel — разбивка эскалаций (Notification manager_escalation) по каналам.
    // Определяем канал по content notification'а (в reason есть строка "Канал: X"
    // для channel-safety-net, а TG-эскалации — по отсутствию этой метки).
    // Fallback категория "unknown" для старых уведомлений.
    const leadsRaw = await prisma.notification.findMany({
      where: {
        businessId: business.id,
        type: "manager_escalation",
        createdAt: { gte: startDate },
      },
      select: { message: true },
    });
    const leadsByChannelMap = new Map<string, number>();
    leadsRaw.forEach((n) => {
      const msg = n.message || "";
      let ch = "telegram"; // default assumption — most escalations are TG side
      if (/Канал:\s*instagram/i.test(msg)) ch = "instagram";
      else if (/Канал:\s*whatsapp/i.test(msg)) ch = "whatsapp";
      else if (/Канал:\s*facebook/i.test(msg)) ch = "facebook";
      leadsByChannelMap.set(ch, (leadsByChannelMap.get(ch) || 0) + 1);
    });
    const leadsByChannel = Array.from(leadsByChannelMap.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      dashboardMode: business.dashboardMode || "service",
      totalMessages,
      totalBookings,
      totalClients: totalClientsCombined || totalClients,
      avgResponseTime,
      conversionRate: conversionRateAdjusted,
      popularQuestions,
      messagesByDay,
      // Trends
      trends: {
        messages: calcTrend(totalMessages, prevMessagesCombined),
        bookings: calcTrend(totalBookings, prevBookings),
        clients: calcTrend(totalClients, prevClientsCombined),
        orders: calcTrend(totalOrders, prevOrders),
        leadsEscalated: calcTrend(leadsEscalatedTotal, leadsEscalatedPrev),
      },
      // Лиды: сколько раз бот эскалировал клиента владельцу (notify_manager).
      // Это то что владелец реально видит как «бот прислал мне ~50 лидов».
      leadsEscalated: leadsEscalatedTotal,
      // Enhanced CRM stats
      customerSegments,
      bookingsByStatus,
      totalRevenue,
      broadcastsSent,
      avgRating,
      // Channel breakdown
      messagesByChannel,
      // Order statistics (for sales/shop businesses)
      totalOrders,
      ordersByStatus,
      orderRevenue,
      avgOrderValue,
      ordersByDay,
      popularProducts,
      // Deal pipeline funnel
      dealFunnel,
      // NEW (июль 2026): загруженность по часам + топ диалогов + heavy alert + leads breakdown
      messagesByHour,
      topConversations,
      heavyConversationsCount,
      heavyConversationsThreshold: HEAVY_CONV_THRESHOLD,
      leadsByChannel,
    });
  } catch (error) {
    console.error("Statistics error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
