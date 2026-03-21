/**
 * WhatsApp webhook — handles ALL scenarios via single URL:
 *
 * Routing (automatic via Phone Number ID lookup):
 *   1. Incoming message → extract phoneNumberId from event metadata
 *   2. Look up Business by waPhoneNumberId → if found, route to business AI
 *   3. Legacy: ?businessId=xxx still supported for backwards compatibility
 *
 * Meta Developers → WhatsApp → Configuration → Webhook URL:
 *   https://staffix.io/api/whatsapp/webhook
 */

export const maxDuration = 60;

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWAWebhook, sendWAMessage, markWAMessageRead } from "@/lib/whatsapp-utils";
import { generateChannelAIResponse } from "@/lib/channel-ai";
import { generateStaffixSalesResponse } from "@/lib/staffix-sales-ai";
import { checkSubscriptionLimit, incrementMessageCount } from "@/lib/subscription-check";
import { verifyMetaWebhookSignature } from "@/lib/meta-webhook-verify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { markWebhookProcessed } from "@/lib/webhook-dedup";
import { sendWhatsAppMessage } from "@/lib/sales-bot/meta-api";

// ─── GET: Webhook verification from Meta ────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const businessId = searchParams.get("businessId");

  if (mode !== "subscribe" || !challenge) {
    return new Response("Bad Request", { status: 400 });
  }

  // Legacy: per-business verification via ?businessId=xxx
  if (businessId) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { waVerifyToken: true },
      });
      if (business?.waVerifyToken && business.waVerifyToken === token) {
        return new Response(challenge, { status: 200 });
      }
    } catch {}
    return new Response("Forbidden", { status: 403 });
  }

  // App-level verify token (for auto-configured webhooks)
  const expected =
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.STAFFIX_WA_VERIFY_TOKEN;
  if (expected && token === expected) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// ─── POST: Incoming message from WhatsApp ────────────────────────────────────
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  const respond200 = () => NextResponse.json({ success: true }, { status: 200 });

  // Rate limit: 120 requests per minute per IP
  const ip = getClientIp(request as NextRequest);
  const rl = await rateLimit(`webhook:wa:${ip}`, 120, 1);
  if (!rl.allowed) {
    return new Response("Too Many Requests", { status: 429 });
  }

  // Verify webhook signature (HMAC-SHA256 from Meta)
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.error("[WA Webhook] Invalid signature — REJECTED");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return respond200();
  }

  // Parse incoming message
  const msg = parseWAWebhook(body);
  if (!msg) return respond200();

  // Skip duplicate webhook deliveries (before any processing)
  if (!(await markWebhookProcessed(msg.messageId))) return respond200();

  // Handle non-text messages (images, audio, stickers, etc.)
  if (msg.type !== "text" || !msg.text.trim()) {
    // Find business to get WA credentials and reply
    const biz = await prisma.business.findFirst({
      where: businessId ? { id: businessId } : { waPhoneNumberId: msg.phoneNumberId, waActive: true },
      select: { waPhoneNumberId: true, waAccessToken: true },
    });
    if (biz?.waPhoneNumberId && biz.waAccessToken) {
      sendWAMessage(biz.waPhoneNumberId, biz.waAccessToken, msg.waId, "Извините, я пока могу работать только с текстовыми сообщениями. Напишите ваш вопрос текстом.").catch(() => {});
    }
    return respond200();
  }

  // Process BEFORE returning 200 — Vercel kills serverless functions after response
  try {
    console.log(`[WA Webhook] Processing message from ${msg.waId} (name: ${msg.name}), phoneNumberId: ${msg.phoneNumberId}, businessId param: ${businessId || 'auto'}`);
    if (businessId) {
      // Legacy: explicit businessId in URL
      await processWAMessage(businessId, msg);
    } else {
      // Auto-route: look up business by phone number ID from event metadata
      const business = await prisma.business.findFirst({
        where: { waPhoneNumberId: msg.phoneNumberId, waActive: true },
        select: { id: true },
      });
      console.log(`[WA Webhook] Auto-route: found business=${business?.id || 'NONE'} for phoneNumberId=${msg.phoneNumberId}`);
      if (business) {
        await processWAMessage(business.id, msg);
      } else {
        // Fallback: Staffix sales bot (Victor)
        console.log(`[WA Webhook] No business found, falling back to sales bot for ${msg.waId}`);
        await processWASalesBot(msg);
      }
    }
  } catch (e) {
    console.error("WA message processing error:", e);
  }

  return respond200();
}

async function processWAMessage(
  businessId: string,
  msg: { waId: string; name: string; text: string; messageId: string; phoneNumberId: string }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        waPhoneNumberId: true,
        waAccessToken: true,
        waActive: true,
      },
    });

    if (!business?.waActive || !business.waPhoneNumberId || !business.waAccessToken) return;

    // Check message limit
    const { allowed, reason } = await checkSubscriptionLimit(businessId);
    if (!allowed) {
      await sendWAMessage(
        business.waPhoneNumberId,
        business.waAccessToken,
        msg.waId,
        "Извините, временно не можем обработать ваш запрос. Пожалуйста, свяжитесь с нами напрямую."
      );
      return;
    }

    // Mark message as read
    await markWAMessageRead(business.waPhoneNumberId, business.waAccessToken, msg.messageId);

    // Generate AI response
    const reply = await generateChannelAIResponse(
      businessId,
      "whatsapp",
      msg.waId,
      msg.text,
      msg.name
    );

    // Send reply
    await sendWAMessage(business.waPhoneNumberId, business.waAccessToken, msg.waId, reply);

    // Increment message usage
    await incrementMessageCount(businessId);
  } catch (e) {
    console.error("processWAMessage error:", e);
  }
}

/**
 * Fallback: Staffix sales bot (Victor) for WhatsApp.
 * Used when phoneNumberId doesn't match any customer business.
 */
async function processWASalesBot(
  msg: { waId: string; name: string; text: string; messageId: string; phoneNumberId: string }
) {
  try {
    // Save/update sales lead
    await prisma.salesLead.upsert({
      where: { whatsappPhone: msg.waId },
      create: {
        whatsappPhone: msg.waId,
        name: msg.name,
        channel: "whatsapp",
        stage: "new",
      },
      update: {
        name: msg.name,
        updatedAt: new Date(),
      },
    }).catch(() => {});

    // Generate sales bot response
    const reply = await generateStaffixSalesResponse("whatsapp", msg.waId, msg.text);

    // Send via Staffix's own WA number
    await sendWhatsAppMessage(msg.waId, reply);

    console.log(`[WA Webhook] Sales bot replied to ${msg.waId}`);
  } catch (e) {
    console.error("[WA Webhook] Sales bot error:", e);
  }
}
