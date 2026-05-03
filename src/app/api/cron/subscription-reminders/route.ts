import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSubscriptionReminder } from "@/lib/email";
import { getPlan, type PlanId } from "@/lib/plans";

// Vercel Cron — runs daily at 09:00 UTC. Sends 7-day / 3-day / 1-day
// reminders before the paid period ends.
//
// Targets only status='cancelled' subscriptions: the user explicitly cancelled
// auto-renewal and risks losing access on expiresAt. Active auto-renewing
// subscriptions don't need our reminder — PayPro sends a renewal receipt and
// the customer expects the charge.
//
// Each reminder type fires once per cycle thanks to the reminder*Sent flags
// on Subscription. The flags are reset in the PayPro webhook on renewal.
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    // Pull cancelled subscriptions expiring in the next 8 days (covers all 3 windows).
    const subs = await prisma.subscription.findMany({
      where: {
        status: "cancelled",
        plan: { not: "trial" },
        expiresAt: { gt: now, lt: new Date(now.getTime() + 8 * DAY_MS) },
      },
      include: {
        business: { include: { user: { select: { email: true, name: true } } } },
      },
      take: 500,
    });

    let sent7 = 0;
    let sent3 = 0;
    let sent1 = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      const user = sub.business.user;
      if (!user?.email) continue;

      const planConfig = getPlan(sub.plan as PlanId);
      const daysLeft = Math.ceil((sub.expiresAt.getTime() - now.getTime()) / DAY_MS);

      // 7-day window: 6 < daysLeft <= 7
      if (!sub.reminder7dSent && daysLeft > 5 && daysLeft <= 7) {
        const r = await sendSubscriptionReminder(
          user.email,
          user.name || "пользователь",
          planConfig.name,
          7
        );
        if (r.success) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { reminder7dSent: true },
          });
          sent7++;
        } else if (r.error) {
          errors.push(`7d ${user.email}: ${r.error}`);
        }
        continue;
      }

      // 3-day window
      if (!sub.reminder3dSent && daysLeft > 1 && daysLeft <= 3) {
        const r = await sendSubscriptionReminder(
          user.email,
          user.name || "пользователь",
          planConfig.name,
          3
        );
        if (r.success) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { reminder3dSent: true },
          });
          sent3++;
        } else if (r.error) {
          errors.push(`3d ${user.email}: ${r.error}`);
        }
        continue;
      }

      // 1-day window
      if (!sub.reminder1dSent && daysLeft >= 0 && daysLeft <= 1) {
        const r = await sendSubscriptionReminder(
          user.email,
          user.name || "пользователь",
          planConfig.name,
          1
        );
        if (r.success) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { reminder1dSent: true },
          });
          sent1++;
        } else if (r.error) {
          errors.push(`1d ${user.email}: ${r.error}`);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: subs.length,
      sent7d: sent7,
      sent3d: sent3,
      sent1d: sent1,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Subscription reminders cron error:", error);
    return NextResponse.json({ error: "Reminders cron failed" }, { status: 500 });
  }
}
