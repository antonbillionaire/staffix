import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBroadcastEmail, sendTelegramNotification } from "@/lib/email";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active admin automations
    const automations = await prisma.adminAutomation.findMany({
      where: { isActive: true },
    });

    if (automations.length === 0) {
      return NextResponse.json({ message: "No active automations", executed: 0 });
    }

    // Get all users with businesses and subscriptions
    const users = await prisma.user.findMany({
      include: {
        businesses: {
          include: { subscription: true },
        },
      },
    });

    let totalExecuted = 0;

    for (const automation of automations) {
      const trigger = automation.trigger;
      const triggerParams = automation.triggerParams as Record<string, unknown>;
      const action = automation.action;
      const actionParams = automation.actionParams as Record<string, unknown>;

      // Find users matching this trigger
      const matchingUsers = await getMatchingUsers(users, trigger, triggerParams);

      for (const user of matchingUsers) {
        // Check if already executed for this user in last 24 hours (avoid duplicates)
        const recentExecution = await prisma.automationExecution.findFirst({
          where: {
            automationId: automation.id,
            userId: user.id,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        if (recentExecution) continue;

        // Execute action
        const result = await executeAction(action, actionParams, user);

        // Record execution
        await prisma.automationExecution.create({
          data: {
            automationId: automation.id,
            userId: user.id,
            userEmail: user.email,
            success: result.success,
            error: result.error || null,
            details: result.details || {},
          },
        });

        if (result.success) totalExecuted++;
      }
    }

    return NextResponse.json({ message: "Done", executed: totalExecuted });
  } catch (error) {
    console.error("Admin automations cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

type UserWithBusiness = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  businesses: Array<{
    name: string;
    subscription: {
      id: string;
      plan: string;
      expiresAt: Date;
      messagesUsed: number;
      messagesLimit: number;
    } | null;
  }>;
};

async function getMatchingUsers(
  users: UserWithBusiness[],
  trigger: string,
  params: Record<string, unknown>
): Promise<UserWithBusiness[]> {
  const now = new Date();

  switch (trigger) {
    case "trial_expiring":
    case "subscription_expiring": {
      const daysBefore = Number(params.days_before) || 3;
      const targetDate = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);
      const windowStart = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000);
      const windowEnd = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000);

      return users.filter((u) => {
        const sub = u.businesses[0]?.subscription;
        if (!sub?.expiresAt) return false;
        const expiry = new Date(sub.expiresAt);
        return expiry >= windowStart && expiry <= windowEnd;
      });
    }

    case "trial_expired": {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return users.filter((u) => {
        const sub = u.businesses[0]?.subscription;
        if (!sub?.expiresAt) return false;
        const expiry = new Date(sub.expiresAt);
        return expiry < now && expiry >= since;
      });
    }

    case "messages_low": {
      const threshold = Number(params.percentage) || 20;
      return users.filter((u) => {
        const sub = u.businesses[0]?.subscription;
        if (!sub) return false;
        const remaining =
          ((sub.messagesLimit - sub.messagesUsed) / sub.messagesLimit) * 100;
        return remaining <= threshold && remaining >= 0;
      });
    }

    case "user_inactive": {
      const daysInactive = Number(params.days_inactive) || 7;
      const cutoff = new Date(now.getTime() - daysInactive * 24 * 60 * 60 * 1000);
      return users.filter((u) => {
        return new Date(u.updatedAt || u.createdAt) < cutoff;
      });
    }

    default:
      return [];
  }
}

async function executeAction(
  action: string,
  params: Record<string, unknown>,
  user: UserWithBusiness
): Promise<{ success: boolean; error?: string; details?: Record<string, unknown> }> {
  const business = user.businesses[0];
  const subscription = business?.subscription;

  try {
    switch (action) {
      case "send_email": {
        const subject = String(params.subject || "Уведомление от Staffix");
        const template = String(params.template || "Здравствуйте!");
        const result = await sendBroadcastEmail(
          user.email,
          user.name || "Пользователь",
          business?.name || "",
          subscription?.plan || "trial",
          subject,
          template
        );
        return { success: result.success, error: result.error };
      }

      case "notify_admin": {
        const msg = String(params.message || "Автоматизация сработала")
          .replace(/\{\{name\}\}/g, user.name || "")
          .replace(/\{\{email\}\}/g, user.email)
          .replace(/\{\{plan\}\}/g, subscription?.plan || "");
        const result = await sendTelegramNotification(
          `🤖 Автоматизация\n${msg}\n👤 ${user.name} (${user.email})`
        );
        return { success: result.success, error: result.error };
      }

      case "extend_trial": {
        if (!subscription) return { success: false, error: "No subscription" };
        const days = Number(params.days) || 7;
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + days);
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { expiresAt: newExpiry },
        });
        return { success: true, details: { days, newExpiry } };
      }

      case "add_messages": {
        if (!subscription) return { success: false, error: "No subscription" };
        const count = Number(params.count) || 100;
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { messagesLimit: { increment: count } },
        });
        return { success: true, details: { added: count } };
      }

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Execution error",
    };
  }
}
