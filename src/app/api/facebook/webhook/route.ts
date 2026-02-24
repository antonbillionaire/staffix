/**
 * Facebook Messenger webhook — handles BOTH scenarios:
 *
 * Scenario A (Staffix Sales Bot):
 *   Messages to Staffix's own FB Page → AI explains Staffix product
 *   ENV: STAFFIX_FB_PAGE_ID, STAFFIX_FB_PAGE_ACCESS_TOKEN, STAFFIX_FB_VERIFY_TOKEN
 *
 * Scenario B (Per-business FB Messenger):
 *   Messages to user's FB Page → business AI bot responds
 *   URL: /api/facebook/webhook?businessId=xxx
 *   DB: business.fbPageId, business.fbPageAccessToken, business.fbVerifyToken
 *
 * Meta Developers → Messenger → Webhooks → Callback URL:
 *   https://staffix.io/api/facebook/webhook          (Scenario A — Staffix page)
 *   https://staffix.io/api/facebook/webhook?businessId=xxx  (Scenario B — user's page)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFBWebhook, sendFBMessage, sendFBTyping } from "@/lib/facebook-utils";
import { generateChannelAIResponse } from "@/lib/channel-ai";
import { generateStaffixSalesResponse } from "@/lib/staffix-sales-ai";

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond200();
  }

  const msg = parseFBWebhook(body);
  if (!msg || !msg.text.trim()) return respond200();

  if (businessId) {
    // Scenario B: user's business
    processBusinessFBMessage(businessId, msg).catch((e) =>
      console.error("FB business error:", e)
    );
  } else {
    // Scenario A: Staffix sales
    processStaffixFBMessage(msg).catch((e) =>
      console.error("FB sales error:", e)
    );
  }

  return respond200();
}

// ─── Scenario A: Staffix sales bot ────────────────────────────────────────────
async function processStaffixFBMessage(msg: {
  senderId: string;
  pageId: string;
  text: string;
}) {
  const accessToken = process.env.STAFFIX_FB_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("Staffix FB: missing STAFFIX_FB_PAGE_ACCESS_TOKEN");
    return;
  }

  await sendFBTyping(accessToken, msg.senderId);

  const reply = await generateStaffixSalesResponse(
    "facebook",
    msg.senderId,
    msg.text
  );

  await sendFBMessage(accessToken, msg.senderId, reply);
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
          "Извините, временно не можем обработать ваш запрос. Свяжитесь с нами напрямую."
        );
        return;
      }
    }

    await sendFBTyping(business.fbPageAccessToken, msg.senderId);

    const reply = await generateChannelAIResponse(
      businessId,
      "facebook",
      msg.senderId,
      msg.text
    );

    await sendFBMessage(business.fbPageAccessToken, msg.senderId, reply);

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
