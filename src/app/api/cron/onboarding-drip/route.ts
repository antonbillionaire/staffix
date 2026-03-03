import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendDripServicesReminder,
  sendDripChannelReminder,
  sendDripReengageReminder,
} from "@/lib/email";

// Vercel Cron — runs daily at 10:00 UTC
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Find users registered 2, 5, or 14 days ago (with 1-day window)
    const day2Start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const day2End = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const day5Start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const day5End = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const day14Start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const day14End = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);

    // Get all users who may need drip emails
    const users = await prisma.user.findMany({
      where: {
        emailVerified: true,
        createdAt: {
          gte: day14Start,
          lte: day2End,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        onboardingEmailsSent: true,
        businesses: {
          select: {
            botToken: true,
            waPhoneNumberId: true,
            waActive: true,
            igBusinessAccountId: true,
            fbPageId: true,
            fbActive: true,
            _count: {
              select: {
                services: true,
                products: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    for (const user of users) {
      const emailsSent = (user.onboardingEmailsSent as string[]) || [];
      const biz = user.businesses[0];
      const daysSinceRegistration = Math.floor(
        (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Day 2: No services/products yet
      if (
        daysSinceRegistration >= 2 &&
        daysSinceRegistration <= 3 &&
        !emailsSent.includes("day2_services") &&
        biz &&
        biz._count.services + biz._count.products === 0
      ) {
        const result = await sendDripServicesReminder(user.email, user.name);
        if (result.success) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              onboardingEmailsSent: [...emailsSent, "day2_services"],
            },
          });
          sent++;
        } else {
          errors.push(`day2 ${user.email}: ${result.error}`);
        }
        continue; // Only 1 email per user per run
      }

      // Day 5: No channel connected
      if (
        daysSinceRegistration >= 5 &&
        daysSinceRegistration <= 6 &&
        !emailsSent.includes("day5_channel") &&
        biz
      ) {
        const hasChannel =
          !!biz.botToken ||
          !!(biz.waPhoneNumberId && biz.waActive) ||
          !!biz.igBusinessAccountId ||
          !!(biz.fbPageId && biz.fbActive);

        if (!hasChannel) {
          const result = await sendDripChannelReminder(user.email, user.name);
          if (result.success) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                onboardingEmailsSent: [...emailsSent, "day5_channel"],
              },
            });
            sent++;
          } else {
            errors.push(`day5 ${user.email}: ${result.error}`);
          }
          continue;
        }
      }

      // Day 14: Still inactive (no business or incomplete setup)
      if (
        daysSinceRegistration >= 14 &&
        daysSinceRegistration <= 15 &&
        !emailsSent.includes("day14_inactive")
      ) {
        const hasChannel = biz && (
          !!biz.botToken ||
          !!(biz.waPhoneNumberId && biz.waActive) ||
          !!biz.igBusinessAccountId ||
          !!(biz.fbPageId && biz.fbActive)
        );
        const hasCatalog = biz && biz._count.services + biz._count.products > 0;

        // Only send if setup is still incomplete
        if (!hasChannel || !hasCatalog) {
          const result = await sendDripReengageReminder(user.email, user.name);
          if (result.success) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                onboardingEmailsSent: [...emailsSent, "day14_inactive"],
              },
            });
            sent++;
          } else {
            errors.push(`day14 ${user.email}: ${result.error}`);
          }
        } else {
          skipped++;
        }
      }
    }

    console.log(`[Onboarding Drip] Processed ${users.length} users, sent ${sent}, skipped ${skipped}, errors: ${errors.length}`);

    return NextResponse.json({
      ok: true,
      processed: users.length,
      sent,
      skipped,
      errors: errors.length,
    });
  } catch (error) {
    console.error("[Onboarding Drip] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
