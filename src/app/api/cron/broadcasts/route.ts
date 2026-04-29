/**
 * Cron Job: Process scheduled broadcasts.
 * Runs every 5 minutes via Vercel Cron.
 *
 * Picks up ClientBroadcast rows with status="scheduled" whose
 * scheduledAt is now or in the past, then sends them via the
 * business's Telegram bot. Updates each delivery row to sent/failed
 * and the broadcast row to "sent".
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAutomationMessage } from "@/lib/automation";

const MAX_BROADCASTS_PER_RUN = 10;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const due = await prisma.clientBroadcast.findMany({
      where: {
        status: "scheduled",
        scheduledAt: { lte: now },
      },
      take: MAX_BROADCASTS_PER_RUN,
      orderBy: { scheduledAt: "asc" },
    });

    let processed = 0;
    let totalSent = 0;
    let totalFailed = 0;

    for (const broadcast of due) {
      try {
        // Mark as sending so a parallel cron tick doesn't pick it up again
        await prisma.clientBroadcast.update({
          where: { id: broadcast.id },
          data: { status: "sending" },
        });

        const business = await prisma.business.findUnique({
          where: { id: broadcast.businessId },
          select: { botToken: true },
        });

        if (!business?.botToken) {
          await prisma.clientBroadcast.update({
            where: { id: broadcast.id },
            data: { status: "failed" },
          });
          continue;
        }

        const deliveries = await prisma.clientBroadcastDelivery.findMany({
          where: { broadcastId: broadcast.id, status: "pending" },
        });

        let sent = 0;
        let failed = 0;

        for (const delivery of deliveries) {
          // Skip placeholder telegramIds (imported clients)
          if (!delivery.telegramId || delivery.telegramId <= BigInt(0)) {
            await prisma.clientBroadcastDelivery.update({
              where: { id: delivery.id },
              data: { status: "failed" },
            });
            failed++;
            continue;
          }

          // Personalise: replace {{имя}} / {{name}} with client.name
          const client = await prisma.client.findUnique({
            where: { id: delivery.clientId },
            select: { name: true },
          });
          const personalised = broadcast.content
            .replace(/\{\{\s*имя\s*\}\}/gi, client?.name || "")
            .replace(/\{\{\s*name\s*\}\}/gi, client?.name || "");

          const result = await sendAutomationMessage(
            business.botToken,
            delivery.telegramId,
            personalised
          );

          if (result.success) {
            await prisma.clientBroadcastDelivery.update({
              where: { id: delivery.id },
              data: { status: "sent", sentAt: new Date() },
            });
            sent++;
          } else {
            await prisma.clientBroadcastDelivery.update({
              where: { id: delivery.id },
              data: { status: "failed" },
            });
            failed++;
          }
        }

        await prisma.clientBroadcast.update({
          where: { id: broadcast.id },
          data: { status: "sent", sentAt: new Date() },
        });

        processed++;
        totalSent += sent;
        totalFailed += failed;
        console.log(`[cron/broadcasts] Sent broadcast ${broadcast.id}: ${sent} sent, ${failed} failed`);
      } catch (e) {
        console.error(`[cron/broadcasts] Failed broadcast ${broadcast.id}:`, e);
        // Reset to scheduled so the next run can retry
        await prisma.clientBroadcast.update({
          where: { id: broadcast.id },
          data: { status: "scheduled" },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      totalSent,
      totalFailed,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[cron/broadcasts] Cron error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
