/**
 * Staffix own WhatsApp sales bot (Scenario A)
 * Potential customers message Staffix's WhatsApp → AI explains the product.
 *
 * Meta Developers → WhatsApp → Configuration → Webhook URL:
 * https://staffix.io/api/whatsapp/sales
 *
 * Required ENV vars:
 *   STAFFIX_WA_PHONE_NUMBER_ID
 *   STAFFIX_WA_ACCESS_TOKEN
 *   STAFFIX_WA_VERIFY_TOKEN
 */

import { NextResponse } from "next/server";
import { parseWAWebhook, sendWAMessage, markWAMessageRead } from "@/lib/whatsapp-utils";
import { generateStaffixSalesResponse } from "@/lib/staffix-sales-ai";
import { verifyMetaWebhookSignature } from "@/lib/meta-webhook-verify";

// ─── GET: Webhook verification ───────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !challenge) {
    return new Response("Bad Request", { status: 400 });
  }

  const expectedToken = process.env.STAFFIX_WA_VERIFY_TOKEN;
  if (!expectedToken || token !== expectedToken) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, { status: 200 });
}

// ─── POST: Incoming message ───────────────────────────────────────────────────
export async function POST(request: Request) {
  const respond200 = () => NextResponse.json({ success: true }, { status: 200 });

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifyMetaWebhookSignature(rawBody, signature)) {
      console.warn("[WA Sales /sales] Signature mismatch (processing anyway)");
    }
    body = JSON.parse(rawBody);
  } catch {
    return respond200();
  }

  const msg = parseWAWebhook(body);
  if (!msg) return respond200();
  if (msg.type !== "text" || !msg.text.trim()) return respond200();

  // Process in background
  processSalesMessage(msg).catch((e) => console.error("WA sales error:", e));

  return respond200();
}

async function processSalesMessage(msg: {
  waId: string;
  name: string;
  text: string;
  messageId: string;
}) {
  const phoneNumberId = process.env.STAFFIX_WA_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.STAFFIX_WA_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error("Staffix WA sales: missing ENV vars");
    return;
  }

  // Mark as read
  await markWAMessageRead(phoneNumberId, accessToken, msg.messageId);

  // Generate sales response
  const reply = await generateStaffixSalesResponse(
    "whatsapp",
    msg.waId,
    msg.text,
    msg.name
  );

  await sendWAMessage(phoneNumberId, accessToken, msg.waId, reply);
}
