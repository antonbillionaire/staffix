/**
 * Shared subscription limit checking and message count incrementing.
 *
 * Used by all webhook handlers (Instagram, Facebook, WhatsApp) to avoid
 * duplicating subscription validation logic.
 */

import { prisma } from "@/lib/prisma";

export interface SubscriptionStatus {
  allowed: boolean;
  reason?: "expired" | "limit_reached";
  subscription?: {
    messagesUsed: number;
    messagesLimit: number;
    expiresAt: Date | null;
  };
}

/**
 * Check whether a business is allowed to process a new message based on
 * its subscription status (expiration date and message limit).
 *
 * If there is no subscription record, the business is allowed (free tier / no limit).
 */
export async function checkSubscriptionLimit(
  businessId: string
): Promise<SubscriptionStatus> {
  const subscription = await prisma.subscription.findUnique({
    where: { businessId },
    select: { messagesUsed: true, messagesLimit: true, expiresAt: true },
  });

  if (!subscription) {
    return { allowed: true };
  }

  const isExpired =
    subscription.expiresAt !== null &&
    new Date(subscription.expiresAt) < new Date();

  const limitReached =
    subscription.messagesLimit !== -1 &&
    subscription.messagesUsed >= subscription.messagesLimit;

  if (isExpired) {
    return { allowed: false, reason: "expired", subscription };
  }

  if (limitReached) {
    return { allowed: false, reason: "limit_reached", subscription };
  }

  return { allowed: true, subscription };
}

/**
 * Increment the messagesUsed counter for a business's subscription.
 * No-op if the subscription does not exist.
 */
export async function incrementMessageCount(
  businessId: string
): Promise<void> {
  try {
    await prisma.subscription.update({
      where: { businessId },
      data: { messagesUsed: { increment: 1 } },
    });
  } catch {
    // Subscription may not exist — that's fine (free tier)
  }
}
