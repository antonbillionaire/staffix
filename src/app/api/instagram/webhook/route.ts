/**
 * Per-business Instagram webhook handler.
 *
 * Routes incoming Instagram DMs to the correct business by looking up
 * igBusinessAccountId from the incoming event. The Meta App's Instagram
 * webhook URL points here: https://staffix.io/api/instagram/webhook
 *
 * Also handles Staffix's own sales bot Instagram if no business match found.
 */

export const maxDuration = 60;

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateChannelAIResponse } from "@/lib/channel-ai";
import { generateStaffixSalesResponse } from "@/lib/staffix-sales-ai";
import { verifyMetaWebhookSignature } from "@/lib/meta-webhook-verify";
import { getPageAccessToken } from "@/lib/facebook-utils";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { markWebhookProcessed } from "@/lib/webhook-dedup";
import { checkSubscriptionLimit, incrementMessageCount } from "@/lib/subscription-check";

const META_API_BASE = "https://graph.facebook.com/v21.0";

// Fetch Instagram user's name by IG-scoped ID (works for DMs and comments)
async function fetchIGUserName(igScopedId: string, accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `${META_API_BASE}/${igScopedId}?fields=name,username&access_token=${accessToken}`
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.name || (data.username ? `@${data.username}` : undefined);
  } catch {
    return undefined;
  }
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

  // Rate limit: 120 requests per minute per IP
  const ip = getClientIp(request as NextRequest);
  const rl = await rateLimit(`webhook:ig:${ip}`, 120, 1);
  if (!rl.allowed) {
    return new Response("Too Many Requests", { status: 429 });
  }

  console.log("[IG Webhook] POST received");

  // Verify webhook signature (HMAC-SHA256 from Meta)
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.error("[IG Webhook] Invalid signature — REJECTED");
    return new Response("Unauthorized", { status: 401 });
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
        if (!(await markWebhookProcessed(messageId))) continue;
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
      if (!(await markWebhookProcessed(messageId))) continue;

      console.log(`[IG Webhook] DM from ${sender.id} to account ${accountId}: "${String(message.text).slice(0, 50)}"`);

      try {
        await processIGMessage(accountId, sender.id, String(message.text));
      } catch (e) {
        console.error("[IG Webhook] processing error:", e);
      }
    }

    // ─── Process Comments (Comment-to-DM) ─────────────────────────────────────
    // Requires: instagram_manage_comments + pages_messaging (Advanced Access)
    // Webhook field: "feed" (subscribed_fields includes "feed")
    const changes = (entry.changes as Array<Record<string, unknown>>) || [];
    for (const change of changes) {
      if (change.field !== "comments" && change.field !== "live_comments") continue;

      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const commentId = value.id as string | undefined;
      const commentText = value.text as string | undefined;
      const from = value.from as Record<string, string> | undefined;
      const commenterId = from?.id;
      const isAdComment = !!value.ad_id;

      if (!commentId || !commentText || !commenterId) continue;

      // Skip replies to existing comments (prevent loops)
      if (value.parent_id) continue;

      if (!(await markWebhookProcessed(commentId))) continue;

      const contextLabel = isAdComment
        ? "Instagram Ad Comment"
        : change.field === "live_comments"
        ? "Instagram Live Comment"
        : "Instagram Post Comment";

      console.log(`[IG Webhook] ${contextLabel} from ${commenterId} on account ${accountId}: "${commentText.slice(0, 50)}"`);

      try {
        await processIGComment(accountId, commentId, commentText, commenterId, contextLabel);
      } catch (e) {
        console.error("[IG Webhook] comment processing error:", e);
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
    },
  });

  // Prefer System User token (never expires), fall back to business token
  const effectiveIGToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
    || process.env.STAFFIX_FB_PAGE_ACCESS_TOKEN
    || business?.fbPageAccessToken;

  if (!business || !effectiveIGToken) {
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

  // Convert System User token → Page Access Token (required for IG Messages API)
  const pageId = business.fbPageId || accountId;
  const pageToken = await getPageAccessToken(pageId, effectiveIGToken).catch(() => effectiveIGToken);
  console.log(`[IG Webhook] Token: effectiveLen=${effectiveIGToken.length}, pageTokenLen=${pageToken.length}, pageId=${pageId}`);

  // Check subscription limits
  const { allowed: subAllowed } = await checkSubscriptionLimit(business.id);
  if (!subAllowed) {
    await sendIGMessage(pageId, pageToken, senderId, "Извините, временно не можем обработать ваш запрос. Свяжитесь с нами напрямую.");
    return;
  }

  await sendIGSenderAction(pageId, pageToken, senderId, "mark_seen");
  await sendIGSenderAction(pageId, pageToken, senderId, "typing_on");

  // Fetch sender name from Instagram API
  const senderName = await fetchIGUserName(senderId, pageToken);

  const reply = await generateChannelAIResponse(
    business.id,
    "instagram",
    senderId,
    text,
    senderName
  );

  const sendResult = await sendIGMessage(pageId, pageToken, senderId, reply);
  console.log(`[IG Webhook] sendIGMessage result: ${sendResult}`);

  // Increment message usage
  await incrementMessageCount(business.id);
}

// ─── Comment-to-DM processing ────────────────────────────────────────────────

async function processIGComment(
  accountId: string,
  commentId: string,
  commentText: string,
  commenterId: string,
  contextLabel: string
) {
  // Look up business by IG account
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
    },
  });

  if (!business || !business.fbPageAccessToken) {
    // Fall back to Staffix sales bot for comments on @staffixio
    console.log(`[IG Webhook] No business for comment on ${accountId}, falling back to sales bot`);
    const staffixToken =
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN ||
      process.env.STAFFIX_FB_PAGE_ACCESS_TOKEN;
    const pageId =
      process.env.FACEBOOK_PAGE_ID ||
      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    if (!staffixToken || !pageId) return;

    const reply = await generateStaffixSalesResponse("instagram_comment", commenterId, commentText);
    await sendIGPrivateReply(pageId, staffixToken, commentId, reply);
    return;
  }

  // Check subscription limits
  const { allowed: commentSubAllowed } = await checkSubscriptionLimit(business.id);
  if (!commentSubAllowed) return; // Silently skip — don't reply to comments if over limit

  const pageId = business.fbPageId || accountId;

  // Fetch commenter name from Instagram API
  const commenterName = await fetchIGUserName(commenterId, business.fbPageAccessToken);

  // Generate AI response based on comment context
  // Use "instagram" channel (not "instagram_comment") so conversations appear in Messages page
  const reply = await generateChannelAIResponse(
    business.id,
    "instagram",
    commenterId,
    `[Комментарий к посту] ${commentText}`,
    commenterName
  );

  // Send private DM reply to the commenter (1 per comment, 7-day window)
  const sent = await sendIGPrivateReply(pageId, business.fbPageAccessToken, commentId, reply);

  if (sent) {
    await incrementMessageCount(business.id);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendIGPrivateReply(
  pageId: string,
  accessToken: string,
  commentId: string,
  text: string
): Promise<boolean> {
  try {
    const pgToken = await getPageAccessToken(pageId, accessToken).catch(() => accessToken);
    const res = await fetch(`${META_API_BASE}/${pageId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pgToken}`,
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: text.slice(0, 1000) }, // IG DM limit
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("IG privateReply error:", err);
      return false;
    }
    console.log(`[IG Webhook] Private reply sent for comment ${commentId}`);
    return true;
  } catch (e) {
    console.error("IG privateReply exception:", e);
    return false;
  }
}

function splitIGMessage(text: string, maxLen = 1000): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const splitAt = remaining.lastIndexOf("\n", maxLen);
    const cutAt = splitAt > maxLen / 2 ? splitAt : maxLen;
    parts.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

async function sendIGMessage(
  igAccountId: string,
  accessToken: string,
  recipientId: string,
  text: string
): Promise<boolean> {
  const chunks = splitIGMessage(text, 1000);
  try {
    for (const chunk of chunks) {
      const res = await fetch(`${META_API_BASE}/${igAccountId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: { text: chunk },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("IG sendMessage error:", err);
        return false;
      }
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
