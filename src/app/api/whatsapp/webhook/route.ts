/**
 * Per-business WhatsApp webhook (Scenario B)
 * Each Staffix user registers their own WhatsApp number here.
 *
 * Meta Developers → WhatsApp → Configuration → Webhook URL:
 * https://staffix.io/api/whatsapp/webhook?businessId=BUSINESS_ID
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWAWebhook, sendWAMessage, markWAMessageRead } from "@/lib/whatsapp-utils";
import { generateChannelAIResponse } from "@/lib/channel-ai";

// ─── GET: Webhook verification from Meta ────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const businessId = searchParams.get("businessId");

  if (!mode || !token || !challenge || !businessId) {
    return new Response("Bad Request", { status: 400 });
  }

  if (mode !== "subscribe") {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { waVerifyToken: true },
    });

    if (!business?.waVerifyToken || business.waVerifyToken !== token) {
      return new Response("Forbidden", { status: 403 });
    }

    // Return challenge to confirm webhook
    return new Response(challenge, { status: 200 });
  } catch (e) {
    console.error("WA webhook verify error:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ─── POST: Incoming message from WhatsApp ────────────────────────────────────
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");

  // Always return 200 immediately to Meta (prevent retries)
  const respond200 = () => NextResponse.json({ success: true }, { status: 200 });

  if (!businessId) return respond200();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond200();
  }

  // Parse incoming message
  const msg = parseWAWebhook(body);
  if (!msg || !msg.text.trim()) return respond200();

  // Process in background (don't await — must return 200 fast)
  processWAMessage(businessId, msg).catch((e) =>
    console.error("WA process error:", e)
  );

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
        subscription: { select: { messagesUsed: true, messagesLimit: true, expiresAt: true } },
      },
    });

    if (!business?.waActive || !business.waPhoneNumberId || !business.waAccessToken) return;

    // Check message limit
    const sub = business.subscription;
    if (sub) {
      const isExpired = new Date(sub.expiresAt) < new Date();
      const limitReached = sub.messagesLimit !== -1 && sub.messagesUsed >= sub.messagesLimit;
      if (isExpired || limitReached) {
        await sendWAMessage(
          business.waPhoneNumberId,
          business.waAccessToken,
          msg.waId,
          "Извините, временно не можем обработать ваш запрос. Пожалуйста, свяжитесь с нами напрямую."
        );
        return;
      }
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
    if (sub) {
      await prisma.subscription.update({
        where: { businessId },
        data: { messagesUsed: { increment: 1 } },
      });
    }
  } catch (e) {
    console.error("processWAMessage error:", e);
  }
}
