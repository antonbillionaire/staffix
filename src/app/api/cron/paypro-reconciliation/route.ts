import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramNotification } from "@/lib/email";

// Vercel Cron — runs hourly. Detects subscriptions whose paid period ended
// but our DB still shows them active because a PayPro webhook (TERMINATED /
// CHARGE_SUCCEED on renewal) was lost. Notifies admin via Telegram so the
// case can be reconciled manually before the customer notices.
//
// Conservative on purpose: we DO NOT auto-expire here, because that would
// cut off a legitimately renewing customer if the SUCCEED webhook is just
// late. We only flag for human review.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // 30-min grace window — PayPro webhooks normally arrive within seconds, but
  // we don't want to alert during that natural lag.
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000);

  try {
    // Stuck-active: paid period ended >30min ago but status is still 'active'
    // and PayPro IDs are present (i.e. this is a real paying subscription, not trial).
    const stuckActive = await prisma.subscription.findMany({
      where: {
        status: "active",
        plan: { not: "trial" },
        payproSubscriptionId: { not: null },
        expiresAt: { lt: cutoff },
      },
      include: {
        business: { include: { user: { select: { email: true, name: true } } } },
      },
      take: 100,
    });

    // Stuck-cancelled: user cancelled, paid period ended, but status still
    // 'cancelled' instead of 'expired'. This is purely cosmetic — but worth
    // fixing so analytics are correct.
    const stuckCancelled = await prisma.subscription.findMany({
      where: {
        status: "cancelled",
        expiresAt: { lt: cutoff },
      },
      take: 100,
    });

    // Auto-fix the stuck-cancelled (safe — user explicitly cancelled, period over).
    let cancelledFixed = 0;
    for (const sub of stuckCancelled) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "expired", payproSubscriptionId: null },
      });
      cancelledFixed++;
    }

    // For stuck-active: alert admin. Not safe to auto-expire.
    if (stuckActive.length > 0) {
      const lines = stuckActive.slice(0, 10).map((s) => {
        const ageHours = Math.floor((now.getTime() - s.expiresAt.getTime()) / (60 * 60 * 1000));
        const email = s.business.user?.email ?? "?";
        return `• ${email} — ${s.plan}, expired ${ageHours}h ago, sub=${s.payproSubscriptionId}`;
      });
      const more = stuckActive.length > 10 ? `\n…and ${stuckActive.length - 10} more` : "";
      await sendTelegramNotification(
        `⚠️ <b>PayPro reconciliation</b>\n${stuckActive.length} subscription(s) stuck active past expiresAt:\n\n${lines.join("\n")}${more}\n\nLikely missed renewal/terminate webhook. Check PayPro dashboard.`
      ).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      stuckActive: stuckActive.length,
      stuckCancelledFixed: cancelledFixed,
    });
  } catch (error) {
    console.error("PayPro reconciliation cron error:", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
