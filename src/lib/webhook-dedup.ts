/**
 * Persistent webhook deduplication via database.
 * Replaces in-memory Set that was lost on serverless cold starts.
 * Uses unique constraint on messageId to prevent duplicates.
 */

import { prisma } from "@/lib/prisma";

/**
 * Try to mark a message as processed. Returns true if this is a new message,
 * false if already processed (duplicate delivery from Meta).
 */
export async function markWebhookProcessed(messageId: string): Promise<boolean> {
  if (!messageId) return false;

  try {
    await prisma.webhookDedup.create({
      data: { id: messageId },
    });
    return true;
  } catch {
    // Unique constraint violation = already processed
    return false;
  }
}

/**
 * Clean up old dedup entries (call from cron job).
 * Removes entries older than 24 hours.
 */
export async function cleanupWebhookDedup(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.webhookDedup.deleteMany({
    where: { processedAt: { lt: cutoff } },
  });
  return result.count;
}
