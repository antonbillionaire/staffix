/**
 * Facebook Messenger webhook — handles ALL scenarios via single URL:
 *
 * Routing (automatic via Page ID lookup):
 *   1. Incoming message → extract pageId from event
 *   2. Look up Business by fbPageId → if found, route to business AI
 *   3. No match → Staffix sales bot responds
 *
 * Legacy: ?businessId=xxx still supported for backwards compatibility.
 *
 * Meta Developers → Messenger → Webhooks → Callback URL:
 *   https://staffix.io/api/facebook/webhook
 */

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFBWebhookAll, sendFBMessage, sendFBTyping } from "@/lib/facebook-utils";
import { generateChannelAIResponse } from "@/lib/channel-ai";
import { generateStaffixSalesResponse } from "@/lib/staffix-sales-ai";
import { verifyMetaWebhookSignature } from "@/lib/meta-webhook-verify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { markWebhookProcessed } from "@/lib/webhook-dedup";

// ─── GET: Webhook verification ───────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const businessId = searchParams.get("businessId");

  if (mode !== "subscribe" || !challenge) {
    return new Response("Bad Request", { status: 400 });
  }

  // Scenario B: per-business verification
  if (businessId) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { fbVerifyToken: true },
      });
      if (business?.fbVerifyToken && business.fbVerifyToken === token) {
        return new Response(challenge, { status: 200 });
      }
    } catch {}
    return new Response("Forbidden", { status: 403 });
  }

  // Scenario A: Staffix's own page
  const expectedToken = process.env.STAFFIX_FB_VERIFY_TOKEN;
  if (expectedToken && token === expectedToken) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// ─── POST: Incoming message ───────────────────────────────────────────────────
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  const respond200 = () => NextResponse.json({ success: true }, { status: 200 });

  // Rate limit: 120 requests per minute per IP
  const ip = getClientIp(request as NextRequest);
  const rl = await rateLimit(`webhook:fb:${ip}`, 120, 1);
  if (!rl.allowed) {
    return new Response("Too Many Requests", { status: 429 });
  }

  // Verify webhook signature (HMAC-SHA256 from Meta)
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.error("[FB Webhook] Invalid signature — REJECTED");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return respond200();
  }

  const messages = parseFBWebhookAll(body);
  if (messages.length === 0) return respond200();

  // Process messages BEFORE returning 200 — Vercel kills serverless functions
  // after response is sent, so fire-and-forget doesn't work reliably.
  // Meta allows up to 20s before timeout, Claude API takes ~3-5s.
  for (const msg of messages) {
    // Handle non-text messages (images, audio, stickers, etc.)
    if (!msg.text.trim()) {
      if (!(await markWebhookProcessed(msg.messageId))) continue;
      const biz = await prisma.business.findFirst({
        where: businessId ? { id: businessId } : { fbPageId: msg.pageId, fbActive: true },
        select: { fbPageAccessToken: true },
      });
      if (biz?.fbPageAccessToken) {
        sendFBMessage(biz.fbPageAccessToken, msg.senderId, "Извините, я пока могу работать только с текстовыми сообщениями. Напишите ваш вопрос текстом.", msg.pageId).catch(() => {});
      }
      continue;
    }

    // Skip duplicate webhook deliveries (Meta retries if response >5s)
    if (!(await markWebhookProcessed(msg.messageId))) continue;

    try {
      if (businessId) {
        // Legacy: explicit businessId in URL
        await processBusinessFBMessage(businessId, msg);
      } else {
        // Auto-route: look up business by page ID from incoming event
        const business = await prisma.business.findFirst({
          where: { fbPageId: msg.pageId, fbActive: true },
          select: { id: true },
        });
        if (business) {
          await processBusinessFBMessage(business.id, msg);
        } else {
          await processStaffixFBMessage(msg);
        }
      }
    } catch (e) {
      console.error("FB message processing error:", e);
    }
  }

  return respond200();
}

// ─── Scenario A: Staffix sales bot ────────────────────────────────────────────
async function processStaffixFBMessage(msg: {
  senderId: string;
  pageId: string;
  text: string;
}) {
  const accessToken = process.env.STAFFIX_FB_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("Staffix FB: missing STAFFIX_FB_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ACCESS_TOKEN");
    return;
  }

  console.log(`FB Sales: processing message from ${msg.senderId}: "${msg.text.slice(0, 50)}"`);

  await sendFBTyping(accessToken, msg.senderId, msg.pageId);

  const reply = await generateStaffixSalesResponse(
    "facebook",
    msg.senderId,
    msg.text
  );

  console.log(`FB Sales: AI reply generated (${reply.length} chars), sending...`);

  const sent = await sendFBMessage(accessToken, msg.senderId, reply, msg.pageId);
  console.log(`FB Sales: message sent = ${sent}`);
}

// ─── Scenario B: per-business FB bot ─────────────────────────────────────────
async function processBusinessFBMessage(
  businessId: string,
  msg: { senderId: string; pageId: string; text: string }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        fbPageAccessToken: true,
        fbActive: true,
        subscription: {
          select: { messagesUsed: true, messagesLimit: true, expiresAt: true },
        },
      },
    });

    if (!business?.fbActive || !business.fbPageAccessToken) return;

    // Check message limit
    const sub = business.subscription;
    if (sub) {
      const isExpired = new Date(sub.expiresAt) < new Date();
      const limitReached = sub.messagesLimit !== -1 && sub.messagesUsed >= sub.messagesLimit;
      if (isExpired || limitReached) {
        await sendFBMessage(
          business.fbPageAccessToken,
          msg.senderId,
          "Извините, временно не можем обработать ваш запрос. Свяжитесь с нами напрямую.",
          msg.pageId
        );
        return;
      }
    }

    await sendFBTyping(business.fbPageAccessToken, msg.senderId, msg.pageId);

    const reply = await generateChannelAIResponse(
      businessId,
      "facebook",
      msg.senderId,
      msg.text
    );

    await sendFBMessage(business.fbPageAccessToken, msg.senderId, reply, msg.pageId);

    if (sub) {
      await prisma.subscription.update({
        where: { businessId },
        data: { messagesUsed: { increment: 1 } },
      });
    }
  } catch (e) {
    console.error("processBusinessFBMessage error:", e);
  }
}
