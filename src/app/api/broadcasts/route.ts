import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendAutomationMessage } from "@/lib/automation";

// Get broadcasts for business
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const whereClause: Record<string, unknown> = { businessId };
    if (status && status !== "all") {
      whereClause.status = status;
    }

    const broadcasts = await prisma.clientBroadcast.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    // Get delivery stats for each broadcast
    const broadcastsWithStats = await Promise.all(
      broadcasts.map(async (broadcast) => {
        const deliveryStats = await prisma.clientBroadcastDelivery.groupBy({
          by: ["status"],
          where: { broadcastId: broadcast.id },
          _count: true,
        });

        const stats = {
          total: broadcast._count.deliveries,
          sent: 0,
          delivered: 0,
          failed: 0,
          pending: 0,
        };

        deliveryStats.forEach((stat) => {
          if (stat.status === "sent") stats.sent = stat._count;
          else if (stat.status === "delivered") stats.delivered = stat._count;
          else if (stat.status === "failed") stats.failed = stat._count;
          else if (stat.status === "pending") stats.pending = stat._count;
        });

        return {
          id: broadcast.id,
          title: broadcast.title,
          content: broadcast.content,
          status: broadcast.status,
          targetSegment: broadcast.targetSegment,
          scheduledAt: broadcast.scheduledAt,
          sentAt: broadcast.sentAt,
          createdAt: broadcast.createdAt,
          stats,
        };
      })
    );

    return NextResponse.json({ broadcasts: broadcastsWithStats });
  } catch (error) {
    console.error("Broadcasts list error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Create new broadcast
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;
    const body = await request.json();
    const { title, content, targetSegment, scheduledAt, sendNow } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля" },
        { status: 400 }
      );
    }

    // Get target clients based on segment
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let clientsWhere: Record<string, unknown> = {
      businessId,
      isBlocked: false,
    };

    // Filter by segment
    if (targetSegment === "vip") {
      clientsWhere.totalVisits = { gte: 5 };
    } else if (targetSegment === "active") {
      clientsWhere.lastVisitDate = { gte: thirtyDaysAgo };
      clientsWhere.totalVisits = { lt: 5 };
    } else if (targetSegment === "inactive") {
      clientsWhere.OR = [
        { lastVisitDate: { lt: thirtyDaysAgo } },
        { lastVisitDate: null },
      ];
    }
    // "all" - no additional filters

    const clients = await prisma.client.findMany({
      where: clientsWhere,
      select: { id: true, telegramId: true, name: true },
    });

    if (clients.length === 0) {
      return NextResponse.json(
        { error: "Нет клиентов для рассылки в выбранном сегменте" },
        { status: 400 }
      );
    }

    // Create broadcast
    const broadcast = await prisma.clientBroadcast.create({
      data: {
        businessId,
        title,
        content,
        targetSegment: targetSegment || "all",
        status: sendNow ? "sending" : scheduledAt ? "scheduled" : "draft",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        recipientsCount: clients.length,
      },
    });

    // Create delivery records
    await prisma.clientBroadcastDelivery.createMany({
      data: clients.map((client) => ({
        broadcastId: broadcast.id,
        clientId: client.id,
        telegramId: client.telegramId,
        status: "pending",
      })),
    });

    // If sendNow, send via Telegram Bot API
    if (sendNow) {
      // Get bot token for this business
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { botToken: true },
      });

      if (!business?.botToken) {
        return NextResponse.json(
          { error: "Бот не настроен. Настройте Telegram бота в разделе AI-сотрудник." },
          { status: 400 }
        );
      }

      // Send to each client via Telegram
      let sentCount = 0;
      let failedCount = 0;

      for (const client of clients) {
        const result = await sendAutomationMessage(
          business.botToken,
          client.telegramId,
          content
        );

        if (result.success) {
          sentCount++;
          await prisma.clientBroadcastDelivery.updateMany({
            where: {
              broadcastId: broadcast.id,
              clientId: client.id,
            },
            data: { status: "sent", sentAt: new Date() },
          });
        } else {
          failedCount++;
          await prisma.clientBroadcastDelivery.updateMany({
            where: {
              broadcastId: broadcast.id,
              clientId: client.id,
            },
            data: { status: "failed" },
          });
        }
      }

      // Update broadcast status
      await prisma.clientBroadcast.update({
        where: { id: broadcast.id },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      broadcast: {
        id: broadcast.id,
        title: broadcast.title,
        status: broadcast.status,
        recipientsCount: clients.length,
      },
    });
  } catch (error) {
    console.error("Broadcast create error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
