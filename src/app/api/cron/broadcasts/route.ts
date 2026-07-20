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
import { sendClientBroadcastEmail } from "@/lib/email";
import { randomBytes } from "crypto";

export const maxDuration = 300;

const MAX_BROADCASTS_PER_RUN = 10;

// Telegram Bot API rate limit: 30 сообщений/сек на бот. Строго держим ниже,
// чтобы не начать получать 429 в середине рассылки. 50мс между send'ами =
// ~20 сообщений/сек — комфортный запас.
const TG_SEND_DELAY_MS = 50;

// Watchdog: если broadcast залип в "sending" дольше этого — считаем что
// Vercel убил функцию посередине (maxDuration=300s превышен), возвращаем
// в "scheduled" чтобы следующий тик его подобрал.
const SENDING_STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 минут

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function getOrCreateUnsubscribeToken(existing: string | null): string {
  if (existing) return existing;
  return randomBytes(24).toString("base64url");
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // WATCHDOG: сначала подбираем "залипшие" рассылки — те что были помечены
    // "sending" > 15 мин назад. Vercel убивает функцию через maxDuration=300s,
    // catch в try..catch не выполнится (SIGKILL), broadcast остаётся в
    // "sending" навсегда. Возвращаем в "scheduled" — с этого прогона они
    // будут пере-подобраны в обычной ветке ниже.
    const stuckThreshold = new Date(now.getTime() - SENDING_STUCK_THRESHOLD_MS);
    const revived = await prisma.clientBroadcast.updateMany({
      where: { status: "sending", updatedAt: { lt: stuckThreshold } },
      data: { status: "scheduled" },
    });
    if (revived.count > 0) {
      console.warn(`[cron/broadcasts] Watchdog revived ${revived.count} stuck broadcasts (were 'sending' > 15min)`);
    }

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
          select: { botToken: true, name: true },
        });

        // For pure-Telegram broadcasts, missing botToken is a hard fail.
        // For email-only / mixed, it's not — we can still send email.
        const tgChannelInUse = broadcast.channel === "telegram" || broadcast.channel === "both";
        if (tgChannelInUse && !business?.botToken && broadcast.channel === "telegram") {
          await prisma.clientBroadcast.update({
            where: { id: broadcast.id },
            data: { status: "failed" },
          });
          continue;
        }

        const deliveries = await prisma.clientBroadcastDelivery.findMany({
          where: { broadcastId: broadcast.id, status: "pending" },
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.staffix.io";
        let sent = 0;
        let failed = 0;

        for (const delivery of deliveries) {
          // Personalise: replace {{имя}} / {{name}} with client.name
          const client = await prisma.client.findUnique({
            where: { id: delivery.clientId },
            select: { name: true, email: true, isBlocked: true, marketingUnsubscribed: true, unsubscribeToken: true },
          });
          if (!client) {
            await prisma.clientBroadcastDelivery.update({
              where: { id: delivery.id },
              data: { status: "failed", error: "client not found" },
            });
            failed++;
            continue;
          }

          // Honour blocks and unsubscribes per channel.
          if (client.isBlocked) {
            await prisma.clientBroadcastDelivery.update({
              where: { id: delivery.id },
              data: { status: "failed", error: "client blocked" },
            });
            failed++;
            continue;
          }
          if (delivery.channel === "email" && client.marketingUnsubscribed) {
            await prisma.clientBroadcastDelivery.update({
              where: { id: delivery.id },
              data: { status: "failed", error: "unsubscribed" },
            });
            failed++;
            continue;
          }

          const personalised = broadcast.content
            .replace(/\{\{\s*имя\s*\}\}/gi, client.name || "")
            .replace(/\{\{\s*name\s*\}\}/gi, client.name || "");

          if (delivery.channel === "telegram") {
            // Skip placeholder telegramIds (imported clients without TG link).
            if (!delivery.telegramId || delivery.telegramId <= BigInt(0)) {
              await prisma.clientBroadcastDelivery.update({
                where: { id: delivery.id },
                data: { status: "failed", error: "no telegram id" },
              });
              failed++;
              continue;
            }
            if (!business?.botToken) {
              await prisma.clientBroadcastDelivery.update({
                where: { id: delivery.id },
                data: { status: "failed", error: "no bot token" },
              });
              failed++;
              continue;
            }
            const result = await sendAutomationMessage(business.botToken, delivery.telegramId, personalised);
            if (result.success) {
              await prisma.clientBroadcastDelivery.update({
                where: { id: delivery.id },
                data: { status: "sent", sentAt: new Date() },
              });
              sent++;
            } else {
              await prisma.clientBroadcastDelivery.update({
                where: { id: delivery.id },
                data: { status: "failed", error: result.error || "telegram send failed" },
              });
              failed++;
            }
            // Throttle к TG API — держим < 30 msg/s per bot.
            await sleep(TG_SEND_DELAY_MS);
          } else if (delivery.channel === "email") {
            const recipientEmail = delivery.email || client.email;
            if (!recipientEmail) {
              await prisma.clientBroadcastDelivery.update({
                where: { id: delivery.id },
                data: { status: "failed", error: "no email" },
              });
              failed++;
              continue;
            }
            // Ensure the client has an unsubscribe token (lazily backfill).
            const token = getOrCreateUnsubscribeToken(client.unsubscribeToken);
            if (!client.unsubscribeToken) {
              await prisma.client.update({
                where: { id: delivery.clientId },
                data: { unsubscribeToken: token },
              }).catch(() => {});
            }
            const unsubscribeUrl = `${appUrl}/api/broadcasts/unsubscribe?token=${token}`;
            const result = await sendClientBroadcastEmail({
              email: recipientEmail,
              clientName: client.name || "клиент",
              businessName: business?.name || "Staffix",
              subject: broadcast.title,
              textContent: personalised,
              unsubscribeUrl,
            });
            if (result.success) {
              await prisma.clientBroadcastDelivery.update({
                where: { id: delivery.id },
                data: { status: "sent", sentAt: new Date() },
              });
              sent++;
            } else {
              await prisma.clientBroadcastDelivery.update({
                where: { id: delivery.id },
                data: { status: "failed", error: result.error || "email send failed" },
              });
              failed++;
            }
          } else {
            await prisma.clientBroadcastDelivery.update({
              where: { id: delivery.id },
              data: { status: "failed", error: `unknown channel ${delivery.channel}` },
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
