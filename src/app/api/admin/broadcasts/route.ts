import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const broadcasts = await prisma.broadcast.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    // Get stats
    const stats = {
      total: broadcasts.length,
      sent: broadcasts.filter((b) => b.status === "sent").length,
      scheduled: broadcasts.filter((b) => b.status === "scheduled").length,
      draft: broadcasts.filter((b) => b.status === "draft").length,
    };

    return NextResponse.json({ broadcasts, stats });
  } catch (error) {
    console.error("Admin broadcasts error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      subject,
      content,
      channel,
      targetPlan,
      targetStatus,
      scheduledFor,
      sendNow,
    } = body;

    if (!name || !content || !channel) {
      return NextResponse.json(
        { error: "Заполните обязательные поля" },
        { status: 400 }
      );
    }

    // Build filter for recipients
    const userWhere: Record<string, unknown> = {};
    const businessInclude: Record<string, unknown> = {
      subscription: true,
    };

    // Get potential recipients count
    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        businesses: {
          include: businessInclude,
        },
      },
    });

    // Filter by plan and status
    let recipients = users.filter((u) => {
      const business = u.businesses[0];
      const subscription = business?.subscription;

      if (!subscription) {
        return targetPlan === "all" || !targetPlan;
      }

      // Plan filter
      if (targetPlan && targetPlan !== "all") {
        if (subscription.plan !== targetPlan) return false;
      }

      // Status filter
      if (targetStatus && targetStatus !== "all") {
        const isExpired = new Date(subscription.expiresAt) < new Date();
        const isExpiring =
          new Date(subscription.expiresAt) <
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        if (targetStatus === "active" && isExpired) return false;
        if (targetStatus === "expired" && !isExpired) return false;
        if (targetStatus === "expiring" && (!isExpiring || isExpired)) return false;
      }

      return true;
    });

    // Create broadcast
    const broadcast = await prisma.broadcast.create({
      data: {
        name,
        subject: subject || null,
        content,
        channel,
        targetPlan: targetPlan || "all",
        targetStatus: targetStatus || "all",
        status: sendNow ? "sending" : scheduledFor ? "scheduled" : "draft",
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        totalRecipients: recipients.length,
      },
    });

    // If sending now, create delivery records and process
    if (sendNow) {
      // Create delivery records
      await prisma.broadcastDelivery.createMany({
        data: recipients.map((u) => ({
          broadcastId: broadcast.id,
          userId: u.id,
          userEmail: u.email,
          status: "pending",
        })),
      });

      // TODO: Actually send the emails/messages
      // For now, just mark as sent
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          delivered: recipients.length,
        },
      });

      // Update delivery statuses
      await prisma.broadcastDelivery.updateMany({
        where: { broadcastId: broadcast.id },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      broadcast,
      recipientsCount: recipients.length,
    });
  } catch (error) {
    console.error("Create broadcast error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
