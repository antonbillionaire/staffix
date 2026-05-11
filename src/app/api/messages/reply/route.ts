/**
 * POST /api/messages/reply
 *
 * Manual reply by the business owner from /dashboard/messages.
 * Sends the message via the customer's connected channel (TG / WA / IG / FB)
 * using the customer's per-channel token, then appends it to the conversation
 * history so it shows up in the dashboard.
 *
 * Body: { clientId: string, channel: "telegram" | "whatsapp" | "instagram" | "facebook", text: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/api";
import { sendFBMessage, getPageAccessToken } from "@/lib/facebook-utils";
import { stripMarkdown } from "@/lib/strip-markdown";

const META_API_BASE = "https://graph.facebook.com/v21.0";

type Channel = "telegram" | "whatsapp" | "instagram" | "facebook";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      clientId?: string;
      channel?: Channel;
      text?: string;
    };
    const clientId = (body.clientId || "").trim();
    const channel = body.channel as Channel;
    const text = (body.text || "").trim();

    if (!clientId || !channel || !text) {
      return NextResponse.json(
        { error: "Missing clientId, channel or text" },
        { status: 400 }
      );
    }
    if (!["telegram", "whatsapp", "instagram", "facebook"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        botToken: true,
        waAccessToken: true,
        waPhoneNumberId: true,
        fbPageId: true,
        fbPageAccessToken: true,
        igBusinessAccountId: true,
      },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const cleanText = stripMarkdown(text);

    // ─── Route by channel ──────────────────────────────────────────────────

    let sent = false;
    let errorMessage: string | null = null;

    if (channel === "telegram") {
      if (!business.botToken) {
        return NextResponse.json(
          { error: "Telegram bot not connected" },
          { status: 400 }
        );
      }
      if (!/^\d+$/.test(clientId)) {
        return NextResponse.json({ error: "Invalid Telegram chat ID" }, { status: 400 });
      }
      sent = await sendTelegramMessage(business.botToken, Number(clientId), cleanText);
      if (!sent) errorMessage = "Telegram API rejected the message";
    } else if (channel === "whatsapp") {
      const token = business.waAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = business.waPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!token || !phoneNumberId) {
        return NextResponse.json(
          { error: "WhatsApp not connected" },
          { status: 400 }
        );
      }
      sent = await sendWhatsAppText(phoneNumberId, token, clientId, cleanText);
      if (!sent) errorMessage = "WhatsApp API rejected the message";
    } else if (channel === "facebook") {
      const pageToken = business.fbPageAccessToken;
      const pageId = business.fbPageId;
      if (!pageToken || !pageId) {
        return NextResponse.json(
          { error: "Facebook Page not connected" },
          { status: 400 }
        );
      }
      sent = await sendFBMessage(pageToken, clientId, cleanText, pageId);
      if (!sent) errorMessage = "Facebook API rejected the message";
    } else if (channel === "instagram") {
      const baseToken = business.fbPageAccessToken;
      const igAccountId = business.igBusinessAccountId || business.fbPageId;
      if (!baseToken || !igAccountId) {
        return NextResponse.json(
          { error: "Instagram not connected" },
          { status: 400 }
        );
      }
      // Convert to Page Access Token (required for IG Messages API)
      const pageToken = await getPageAccessToken(
        business.fbPageId || igAccountId,
        baseToken
      ).catch(() => baseToken);
      sent = await sendIGText(igAccountId, pageToken, clientId, cleanText);
      if (!sent) errorMessage = "Instagram API rejected the message";
    }

    if (!sent) {
      console.error(`[Manual Reply] Failed (${channel}, business=${business.id}):`, errorMessage);
      return NextResponse.json(
        { error: errorMessage || "Failed to send message" },
        { status: 502 }
      );
    }

    // ─── Append to conversation history ────────────────────────────────────

    if (channel === "telegram") {
      const conversation = await prisma.conversation.findFirst({
        where: {
          businessId: business.id,
          clientTelegramId: BigInt(clientId),
        },
      });
      if (conversation) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: cleanText,
          },
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });
      }
    } else {
      // Channel conversation (WA/IG/FB)
      const conv = await prisma.channelConversation.findFirst({
        where: {
          businessId: business.id,
          channel,
          clientId,
        },
      });
      if (conv) {
        // Read fresh history to avoid race with bot AI reply
        const history = (conv.history as Array<{ role: string; content: string }>) || [];
        history.push({ role: "assistant", content: cleanText });
        await prisma.channelConversation.update({
          where: { id: conv.id },
          data: {
            history,
            messageCount: { increment: 1 },
            updatedAt: new Date(),
          },
        });
      }
    }

    console.log(`[Manual Reply] Sent (${channel}, business=${business.id}, to=${clientId.slice(0, 8)}...)`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Manual Reply] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── Channel-specific senders ────────────────────────────────────────────────

async function sendWhatsAppText(
  phoneNumberId: string,
  accessToken: string,
  recipientPhone: string,
  text: string
): Promise<boolean> {
  try {
    const cleanPhone = recipientPhone.replace(/[\s\-\(\)]/g, "");
    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: text },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Manual Reply] WA send error:", err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Manual Reply] WA send exception:", e);
    return false;
  }
}

async function sendIGText(
  igAccountId: string,
  pageAccessToken: string,
  recipientId: string,
  text: string
): Promise<boolean> {
  try {
    // IG DM limit is 1000 chars per message; split if needed.
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 1000) {
      const splitAt = remaining.lastIndexOf("\n", 1000);
      const cut = splitAt > 500 ? splitAt : 1000;
      chunks.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) chunks.push(remaining);

    for (const chunk of chunks) {
      const res = await fetch(`${META_API_BASE}/${igAccountId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pageAccessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: { text: chunk },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[Manual Reply] IG send error:", err);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error("[Manual Reply] IG send exception:", e);
    return false;
  }
}
