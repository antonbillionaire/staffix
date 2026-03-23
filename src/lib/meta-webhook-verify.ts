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
  // Collect all possible app secrets (main app + Instagram app)
  const secrets = [
    process.env.META_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  ].filter(Boolean) as string[];

  // If no secrets configured, skip verification (development mode)
  if (secrets.length === 0) return true;

  // If Meta didn't send a signature, reject
  if (!signatureHeader) return false;

  // Try each secret — Instagram webhooks may use a different app secret
  for (const secret of secrets) {
    const expectedSignature =
      "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(signatureHeader);
    if (expected.length === received.length && timingSafeEqual(expected, received)) {
      return true;
    }
  }

  return false;
}
