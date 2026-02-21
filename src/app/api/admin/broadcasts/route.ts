import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { sendBroadcastEmail } from "@/lib/email";

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
      attachments,
    } = body;

    if (!name || !content || !channel) {
      return NextResponse.json(
        { error: "Заполните обязательные поля" },
        { status: 400 }
      );
    }

    // Get potential recipients with their subscriptions
    const users = await prisma.user.findMany({
      include: {
        businesses: {
          include: {
            subscription: true,
          },
        },
      },
    });

    // Filter by plan and status
    const recipients = users.filter((u) => {
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

      // Send emails in batches to avoid rate limits
      let delivered = 0;
      const BATCH_SIZE = 5;

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (u) => {
            const business = u.businesses[0];
            const plan = business?.subscription?.plan || "trial";
            const businessName = business?.name || "";

            try {
              if (channel === "email") {
                const emailSubject = subject || name;
                const result = await sendBroadcastEmail(
                  u.email,
                  u.name || "Пользователь",
                  businessName,
                  plan,
                  emailSubject,
                  content,
                  attachments
                );

                if (result.success) {
                  delivered++;
                  await prisma.broadcastDelivery.updateMany({
                    where: { broadcastId: broadcast.id, userId: u.id },
                    data: { status: "sent", sentAt: new Date() },
                  });
                } else {
                  await prisma.broadcastDelivery.updateMany({
                    where: { broadcastId: broadcast.id, userId: u.id },
                    data: { status: "failed", error: result.error },
                  });
                }
              } else {
                // telegram / in_app — mark as sent (actual delivery handled separately)
                delivered++;
                await prisma.broadcastDelivery.updateMany({
                  where: { broadcastId: broadcast.id, userId: u.id },
                  data: { status: "sent", sentAt: new Date() },
                });
              }
            } catch {
              await prisma.broadcastDelivery.updateMany({
                where: { broadcastId: broadcast.id, userId: u.id },
                data: { status: "failed", error: "Unexpected error" },
              });
            }
          })
        );

        // Small delay between batches
        if (i + BATCH_SIZE < recipients.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          delivered,
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
