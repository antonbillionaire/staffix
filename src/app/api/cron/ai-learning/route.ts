/**
 * Cron Job: AI Learning — process channel conversations
 * Runs every 6 hours via Vercel Cron
 *
 * - Generates summaries for channel conversations that need it
 * - Updates channel client profiles with recent activity
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateChannelConversationSummary,
  updateChannelClientSummary,
} from "@/lib/channel-memory";

const MAX_CONVERSATIONS = 20;

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = {
      processed: 0,
      clientsUpdated: 0,
      errors: [] as string[],
    };

    // 1. Find channel conversations needing summary
    const conversationsNeedingSummary = await prisma.channelConversation.findMany({
      where: { needsSummary: true },
      select: {
        id: true,
        businessId: true,
        clientId: true,
        channel: true,
      },
      take: MAX_CONVERSATIONS,
    });

    console.log(
      `[ai-learning] Found ${conversationsNeedingSummary.length} conversations needing summary`
    );

    // 2. Generate summaries
    for (const conv of conversationsNeedingSummary) {
      try {
        await generateChannelConversationSummary(conv.id);
        results.processed++;
      } catch (error) {
        results.errors.push(`Conversation ${conv.id}: ${error}`);
      }
    }

    // 3. Update channel client summaries for clients with recent activity
    const recentClients = await prisma.channelClient.findMany({
      where: {
        lastContactAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24 hours
        },
        OR: [
          { aiSummary: null, totalMessages: { gte: 3 } },
          { totalMessages: { gte: 5 } },
        ],
      },
      select: {
        id: true,
        businessId: true,
      },
      take: 10,
    });

    console.log(
      `[ai-learning] Found ${recentClients.length} clients needing summary update`
    );

    for (const client of recentClients) {
      try {
        await updateChannelClientSummary(client.id);
        results.clientsUpdated++;
      } catch (error) {
        results.errors.push(`Client ${client.id}: ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ai-learning] Cron error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// GET also supported (for Vercel Cron)
export async function GET(request: Request) {
  return POST(request);
}
