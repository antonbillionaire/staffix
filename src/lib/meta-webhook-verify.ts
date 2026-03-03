/**
 * Meta Webhook Signature Verification (HMAC-SHA256)
 * Verifies that incoming webhook events are actually from Meta.
 * Uses X-Hub-Signature-256 header with META_APP_SECRET.
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify the X-Hub-Signature-256 header from Meta webhooks.
 * Returns true if signature is valid, or if verification is disabled (no secret configured).
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.META_APP_SECRET;

  // If no app secret configured, skip verification (development mode)
  if (!appSecret) return true;

  // If Meta didn't send a signature, reject
  if (!signatureHeader) return false;

  // Expected format: "sha256=<hex_digest>"
  const expectedSignature =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");

  // Use constant-time comparison to prevent timing attacks
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signatureHeader);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
