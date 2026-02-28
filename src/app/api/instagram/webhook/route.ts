/**
 * Per-business Instagram webhook handler.
 *
 * Routes incoming Instagram DMs to the correct business by looking up
 * igBusinessAccountId from the incoming event. The Meta App's Instagram
 * webhook URL points here: https://staffix.io/api/instagram/webhook
 *
 * Also handles Staffix's own sales bot Instagram if no business match found.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateChannelAIResponse } from "@/lib/channel-ai";
import { generateStaffixSalesResponse } from "@/lib/staffix-sales-ai";
import { verifyMetaWebhookSignature } from "@/lib/meta-webhook-verify";
import { getPageAccessToken } from "@/lib/facebook-utils";

const META_API_BASE = "https://graph.facebook.com/v21.0";

// Deduplication
const processedIGMessages = new Set<string>();
function markIGProcessed(id: string): boolean {
  if (!id || processedIGMessages.has(id)) return false;
  processedIGMessages.add(id);
  setTimeout(() => processedIGMessages.delete(id), 60_000);
  return true;
}

// ─── GET: Webhook verification ───────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !challenge) {
    return new Response("Bad Request", { status: 400 });
  }

  // Accept app-level verify tokens
  const expected =
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.STAFFIX_FB_VERIFY_TOKEN;
  if (expected && token === expected) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// ─── POST: Incoming Instagram DM ─────────────────────────────────────────────
export async function POST(request: Request) {
  const respond200 = () => NextResponse.json({ success: true }, { status: 200 });

  console.log("[IG Webhook] POST received");

  // Verify webhook signature (HMAC-SHA256 from Meta)
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn("[IG Webhook] Signature mismatch (processing anyway)");
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error("[IG Webhook] Failed to parse body:", e);
    return respond200();
  }

  console.log("[IG Webhook] object:", body.object, "entries:", (body.entry as unknown[])?.length || 0);

  // Instagram events have object: "instagram"
  if (body.object !== "instagram" && body.object !== "page") {
    console.log("[IG Webhook] Ignoring non-instagram object:", body.object);
    return respond200();
  }

  for (const entry of (body.entry as Array<Record<string, unknown>>) || []) {
    const accountId = String(entry.id); // IG Business Account ID or Page ID

    // Process DMs
    for (const messaging of (entry.messaging as Array<Record<string, unknown>>) || []) {
      const sender = messaging.sender as Record<string, string> | undefined;
      const message = messaging.message as Record<string, unknown> | undefined;

      if (!sender?.id || !message) continue;
      if (message.is_echo) continue;

      // Handle non-text messages (images, audio, stickers, etc.)
      if (!message.text) {
        const messageId = String(message.mid || "");
        if (!markIGProcessed(messageId)) continue;
        // Find business to reply
        const biz = await prisma.business.findFirst({
          where: { OR: [{ igBusinessAccountId: accountId, igActive: true }, { fbPageId: accountId, igActive: true }] },
          select: { fbPageAccessToken: true, fbPageId: true },
        });
        if (biz?.fbPageAccessToken && biz.fbPageId) {
          const pgToken = await getPageAccessToken(biz.fbPageId, biz.fbPageAccessToken).catch(() => biz.fbPageAccessToken!);
          await sendIGMessage(biz.fbPageId, pgToken, sender.id, "Извините, я пока могу работать только с текстовыми сообщениями. Напишите ваш вопрос текстом.").catch(() => {});
        }
        continue;
      }

      const messageId = String(message.mid || "");
      if (!markIGProcessed(messageId)) continue;

      console.log(`[IG Webhook] DM from ${sender.id} to account ${accountId}: "${String(message.text).slice(0, 50)}"`);

      try {
        await processIGMessage(accountId, sender.id, String(message.text));
      } catch (e) {
        console.error("[IG Webhook] processing error:", e);
      }
    }
  }

  return respond200();
}

async function processIGMessage(
  accountId: string,
  senderId: string,
  text: string
) {
  // Look up business by Instagram Business Account ID
  const business = await prisma.business.findFirst({
    where: {
      OR: [
        { igBusinessAccountId: accountId, igActive: true },
        { fbPageId: accountId, igActive: true },
      ],
    },
    select: {
      id: true,
      fbPageId: true,
      fbPageAccessToken: true,
      subscription: {
        select: { messagesUsed: true, messagesLimit: true, expiresAt: true },
      },
    },
  });

  if (!business || !business.fbPageAccessToken) {
    // Not a customer business — fall back to Staffix sales bot
    console.log(`[IG Webhook] No business found for account ${accountId}, falling back to sales bot`);
    const staffixToken =
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN ||
      process.env.STAFFIX_FB_PAGE_ACCESS_TOKEN;
    if (!staffixToken) {
      console.error("[IG Webhook] No FACEBOOK_PAGE_ACCESS_TOKEN or STAFFIX_FB_PAGE_ACCESS_TOKEN set!");
      return;
    }

    const reply = await generateStaffixSalesResponse("instagram", senderId, text);
    const pageId =
      process.env.FACEBOOK_PAGE_ID ||
      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    console.log(`[IG Webhook] Sales bot reply to ${senderId} via pageId=${pageId}`);
    if (pageId) {
      // System User token → Page Access Token (required for IG Messages API)
      const pageToken = await getPageAccessToken(pageId, staffixToken);
      await sendIGSenderAction(pageId, pageToken, senderId, "mark_seen");
      await sendIGSenderAction(pageId, pageToken, senderId, "typing_on");
      await sendIGMessage(pageId, pageToken, senderId, reply);
    }
    return;
  }

  // Check subscription limits
  const sub = business.subscription;
  if (sub) {
    const isExpired = new Date(sub.expiresAt) < new Date();
    const limitReached = sub.messagesLimit !== -1 && sub.messagesUsed >= sub.messagesLimit;
    if (isExpired || limitReached) {
      await sendIGMessage(
        business.fbPageId || accountId,
        business.fbPageAccessToken,
        senderId,
        "Извините, временно не можем обработать ваш запрос. Свяжитесь с нами напрямую."
      );
      return;
    }
  }

  const pageId = business.fbPageId || accountId;
  await sendIGSenderAction(pageId, business.fbPageAccessToken, senderId, "mark_seen");
  await sendIGSenderAction(pageId, business.fbPageAccessToken, senderId, "typing_on");

  const reply = await generateChannelAIResponse(
    business.id,
    "instagram",
    senderId,
    text
  );

  await sendIGMessage(pageId, business.fbPageAccessToken, senderId, reply);

  // Increment message usage
  if (sub) {
    await prisma.subscription.update({
      where: { businessId: business.id },
      data: { messagesUsed: { increment: 1 } },
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendIGMessage(
  igAccountId: string,
  accessToken: string,
  recipientId: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(`${META_API_BASE}/${igAccountId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("IG sendMessage error:", err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("IG sendMessage exception:", e);
    return false;
  }
}

async function sendIGSenderAction(
  igAccountId: string,
  accessToken: string,
  recipientId: string,
  action: "typing_on" | "typing_off" | "mark_seen"
): Promise<void> {
  try {
    await fetch(`${META_API_BASE}/${igAccountId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: action,
      }),
    });
  } catch {}
}
