import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAutomationMessage } from "@/lib/automation";
import { sendClientBroadcastEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import { getCurrentBusinessId } from "@/lib/auth-helpers";
import { checkSubscriptionLimit } from "@/lib/subscription-check";

const VALID_CHANNELS = ["telegram", "email", "both"] as const;
type BroadcastChannel = (typeof VALID_CHANNELS)[number];

// Get broadcasts for business
export async function GET(request: NextRequest) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
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
          channel: broadcast.channel,
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
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, targetSegment, scheduledAt, sendNow } = body;
    const channel: BroadcastChannel = (VALID_CHANNELS as readonly string[]).includes(body.channel)
      ? (body.channel as BroadcastChannel)
      : "telegram";

    if (!title || !content) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля" },
        { status: 400 }
      );
    }

    // Subscription gate. Outbound broadcasts on a trial/expired/suspended
    // account would let the owner keep using paid features without paying —
    // and a single broadcast can fan out to thousands of recipients, eating
    // the message quota silently. Block at the entry point.
    const subStatus = await checkSubscriptionLimit(businessId);
    if (!subStatus.allowed) {
      return NextResponse.json(
        {
          error: "subscription_blocked",
          reason: subStatus.reason,
          message:
            subStatus.reason === "limit_reached"
              ? "Лимит сообщений исчерпан. Обновите тариф, чтобы отправлять рассылки."
              : subStatus.reason === "suspended"
              ? "Подписка приостановлена. Обновите данные карты, чтобы продолжить."
              : "Подписка истекла. Продлите тариф, чтобы отправлять рассылки.",
        },
        { status: 402 }
      );
    }

    // Segment filter (visit-based, applies to both channels).
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const segmentFilter: Record<string, unknown> = {};
    if (targetSegment === "vip") {
      segmentFilter.totalVisits = { gte: 5 };
    } else if (targetSegment === "active") {
      segmentFilter.lastVisitDate = { gte: thirtyDaysAgo };
      segmentFilter.totalVisits = { lt: 5 };
    } else if (targetSegment === "inactive") {
      segmentFilter.OR = [
        { lastVisitDate: { lt: thirtyDaysAgo } },
        { lastVisitDate: null },
      ];
    }

    // Pick eligible clients for each channel separately, then merge.
    // Telegram: must have a positive chat-id (i.e. написал /start, не импорт).
    // Email: must have email AND not be unsubscribed from marketing.
    const wantTg = channel === "telegram" || channel === "both";
    const wantEmail = channel === "email" || channel === "both";

    const tgClients = wantTg
      ? await prisma.client.findMany({
          where: {
            businessId,
            isBlocked: false,
            telegramId: { gt: BigInt(0) },
            ...segmentFilter,
          },
          select: { id: true, telegramId: true, name: true },
        })
      : [];

    const emailClients = wantEmail
      ? await prisma.client.findMany({
          where: {
            businessId,
            isBlocked: false,
            marketingUnsubscribed: false,
            email: { not: null },
            ...segmentFilter,
          },
          select: { id: true, telegramId: true, name: true, email: true, unsubscribeToken: true },
        })
      : [];

    // Same client may appear in both lists (when channel="both") — that's fine,
    // each gets its own delivery row with its own channel.
    const totalRecipients = tgClients.length + emailClients.length;
    if (totalRecipients === 0) {
      return NextResponse.json(
        { error: "Нет клиентов в выбранном сегменте/канале. Для Telegram — клиенты должны написать боту /start. Для Email — у клиента должен быть указан email." },
        { status: 400 }
      );
    }

    // Backfill unsubscribe tokens for email clients lazily so they can opt out
    // from any future broadcast.
    if (wantEmail) {
      for (const c of emailClients) {
        if (!c.unsubscribeToken) {
          const token = randomBytes(24).toString("base64url");
          await prisma.client.update({
            where: { id: c.id },
            data: { unsubscribeToken: token },
          }).catch(() => {});
          c.unsubscribeToken = token;
        }
      }
    }

    // Create broadcast row
    const broadcast = await prisma.clientBroadcast.create({
      data: {
        businessId,
        title,
        content,
        targetSegment: targetSegment || "all",
        channel,
        status: sendNow ? "sending" : scheduledAt ? "scheduled" : "draft",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        recipientsCount: totalRecipients,
      },
    });

    // Delivery rows — one per (client, channel) pair.
    const deliveryRows = [
      ...tgClients.map((c) => ({
        broadcastId: broadcast.id,
        clientId: c.id,
        telegramId: c.telegramId,
        channel: "telegram",
        status: "pending",
      })),
      ...emailClients.map((c) => ({
        broadcastId: broadcast.id,
        clientId: c.id,
        telegramId: c.telegramId, // snapshot — null/0 ok for email-only paths
        email: c.email,
        channel: "email",
        status: "pending",
      })),
    ];
    if (deliveryRows.length > 0) {
      await prisma.clientBroadcastDelivery.createMany({ data: deliveryRows });
    }

    // sendNow path — send synchronously now (otherwise cron picks it up).
    if (sendNow) {
      const business = wantTg
        ? await prisma.business.findUnique({
            where: { id: businessId },
            select: { botToken: true, name: true },
          })
        : await prisma.business.findUnique({
            where: { id: businessId },
            select: { botToken: true, name: true },
          });

      if (wantTg && !business?.botToken && channel === "telegram") {
        return NextResponse.json(
          { error: "Бот не настроен. Настройте Telegram бота в разделе AI-сотрудник." },
          { status: 400 }
        );
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io";

      // Telegram pass
      for (const c of tgClients) {
        // tgClients фильтруются выше по наличию telegramId, но TS теперь видит
        // client.telegramId как nullable — гардим и пропускаем импортированных
        // без TG-идентичности вместо падения.
        if (!c.telegramId) continue;
        const personalised = content
          .replace(/\{\{\s*имя\s*\}\}/gi, c.name || "")
          .replace(/\{\{\s*name\s*\}\}/gi, c.name || "");
        if (!business?.botToken) break;
        const result = await sendAutomationMessage(business.botToken, c.telegramId, personalised);
        await prisma.clientBroadcastDelivery.updateMany({
          where: { broadcastId: broadcast.id, clientId: c.id, channel: "telegram" },
          data: { status: result.success ? "sent" : "failed", sentAt: new Date() },
        });
      }

      // Email pass
      for (const c of emailClients) {
        if (!c.email) continue;
        const personalised = content
          .replace(/\{\{\s*имя\s*\}\}/gi, c.name || "")
          .replace(/\{\{\s*name\s*\}\}/gi, c.name || "");
        const unsubscribeUrl = `${appUrl}/api/broadcasts/unsubscribe?token=${c.unsubscribeToken}`;
        const result = await sendClientBroadcastEmail({
          email: c.email,
          clientName: c.name || "клиент",
          businessName: business?.name || "Staffix",
          subject: title,
          textContent: personalised,
          unsubscribeUrl,
        });
        await prisma.clientBroadcastDelivery.updateMany({
          where: { broadcastId: broadcast.id, clientId: c.id, channel: "email" },
          data: { status: result.success ? "sent" : "failed", sentAt: new Date() },
        });
      }

      await prisma.clientBroadcast.update({
        where: { id: broadcast.id },
        data: { status: "sent", sentAt: new Date() },
      });
    }

    return NextResponse.json({
      broadcast: {
        id: broadcast.id,
        title: broadcast.title,
        status: broadcast.status,
        channel,
        recipientsCount: totalRecipients,
      },
    });
  } catch (error) {
    console.error("Broadcast create error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
