import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const checks: Record<string, { status: "ok" | "warn" | "error"; detail: string }> = {};

    // 1. Database connectivity
    try {
      const count = await prisma.user.count();
      checks.database = { status: "ok", detail: `${count} users` };
    } catch (err) {
      checks.database = { status: "error", detail: err instanceof Error ? err.message : "Connection failed" };
    }

    // 2. Last webhook processed
    try {
      const latest = await prisma.webhookDedup.findFirst({
        orderBy: { processedAt: "desc" },
      });
      if (!latest) {
        checks.webhooks = { status: "warn", detail: "No webhooks recorded" };
      } else {
        const ageMs = Date.now() - latest.processedAt.getTime();
        const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
        if (ageHours > 24) {
          checks.webhooks = { status: "warn", detail: `Last webhook ${ageHours}h ago` };
        } else {
          const ageMin = Math.floor(ageMs / (1000 * 60));
          checks.webhooks = { status: "ok", detail: `Last webhook ${ageMin}m ago` };
        }
      }
    } catch (err) {
      checks.webhooks = { status: "error", detail: err instanceof Error ? err.message : "Query failed" };
    }

    // 3. Active businesses with connected channels
    try {
      const withTelegram = await prisma.business.count({ where: { botToken: { not: null } } });
      const channelConns = await prisma.channelConnection.count({ where: { isConnected: true } });
      checks.channels = {
        status: withTelegram + channelConns > 0 ? "ok" : "warn",
        detail: `TG: ${withTelegram}, Other: ${channelConns}`,
      };
    } catch (err) {
      checks.channels = { status: "error", detail: err instanceof Error ? err.message : "Query failed" };
    }

    // 4. Recent AI activity (messages in last 24h)
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentMessages = await prisma.message.count({
        where: { createdAt: { gte: yesterday } },
      });
      checks.aiActivity = {
        status: recentMessages > 0 ? "ok" : "warn",
        detail: `${recentMessages} messages in 24h`,
      };
    } catch (err) {
      checks.aiActivity = { status: "error", detail: err instanceof Error ? err.message : "Query failed" };
    }

    // Overall status
    const statuses = Object.values(checks).map((c) => c.status);
    const overall = statuses.includes("error") ? "error" : statuses.includes("warn") ? "warn" : "ok";

    return NextResponse.json({ status: overall, checks, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
