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

  // If no secrets configured, reject (fail-secure)
  if (secrets.length === 0) {
    console.error("[Webhook Verify] No META_APP_SECRET or INSTAGRAM_APP_SECRET configured — rejecting webhook");
    return false;
  }

  // If Meta didn't send a signature, reject
  if (!signatureHeader) {
    console.error("[Webhook Verify] No x-hub-signature-256 header — rejecting webhook");
    return false;
  }

  const computedSignatures: string[] = [];

  // Try each secret — Instagram webhooks may use a different app secret
  for (const secret of secrets) {
    const expectedSignature =
      "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
    computedSignatures.push(expectedSignature);

    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(signatureHeader);
    if (expected.length === received.length && timingSafeEqual(expected, received)) {
      return true;
    }
  }

  // Diagnostic log on mismatch. Sig and computed sigs are HMAC hashes — not
  // secrets themselves, safe to log. Body length only, not body content.
  console.error("[Webhook Verify] Signature mismatch:", JSON.stringify({
    bodyLength: rawBody.length,
    bodyPreview: rawBody.slice(0, 80),
    receivedSig: signatureHeader,
    receivedSigLength: signatureHeader.length,
    secretsConfigured: [
      process.env.META_APP_SECRET ? "META_APP_SECRET" : null,
      process.env.INSTAGRAM_APP_SECRET ? "INSTAGRAM_APP_SECRET" : null,
    ].filter(Boolean),
    computedSignatures,
  }));

  return false;
}
