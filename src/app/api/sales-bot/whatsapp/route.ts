import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getSalesSystemPrompt } from "@/lib/sales-bot/system-prompt";
import {
  sendWhatsAppMessage,
  markWhatsAppRead,
  verifyMetaWebhook,
} from "@/lib/sales-bot/meta-api";
import { verifyMetaWebhookSignature } from "@/lib/meta-webhook-verify";

// Conversation history helpers — persisted in SalesLead.history (DB-backed)
type HistoryMessage = { role: "user" | "assistant"; content: string };

async function getLeadHistory(whatsappPhone: string): Promise<HistoryMessage[]> {
  try {
    const lead = await prisma.salesLead.findUnique({
      where: { whatsappPhone },
      select: { history: true },
    });
    return (lead?.history as HistoryMessage[]) || [];
  } catch {
    return [];
  }
}

async function saveLeadHistory(whatsappPhone: string, history: HistoryMessage[]): Promise<void> {
  try {
    await prisma.salesLead.update({
      where: { whatsappPhone },
      data: { history: history.slice(-40) as unknown as [] },
    });
  } catch {
    // Lead may not exist yet
  }
}

// Generate AI response
async function generateAIResponse(
  userMessage: string,
  senderPhone: string,
  senderName: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "Извините, сервис временно недоступен. Посетите https://staffix.io";
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    let history = await getLeadHistory(senderPhone);

    if (history.length > 20) {
      history = history.slice(-20);
    }

    history.push({ role: "user", content: userMessage });

    const systemPrompt =
      getSalesSystemPrompt() +
      `\n\nКанал: WhatsApp. Собеседник: ${senderName} (тел: ${senderPhone})`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Извините, не могу обработать ваш запрос.";

    history.push({ role: "assistant", content: assistantMessage });
    await saveLeadHistory(senderPhone, history);

    return assistantMessage;
  } catch (error) {
    console.error("Sales bot WhatsApp: AI error:", error);
    return "Произошла ошибка. Посетите https://staffix.io";
  }
}

// Webhook verification (GET)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const result = verifyMetaWebhook(mode, token, challenge);

  if (result.valid) {
    return new NextResponse(result.challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// Webhook handler (POST)
export async function POST(request: NextRequest) {
  console.log("[WA Sales Webhook] POST received");
  try {
    // Verify webhook signature (HMAC-SHA256 from Meta)
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifyMetaWebhookSignature(rawBody, signature)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log("[WA Sales Webhook] object:", body.object);

    // WhatsApp webhook payload structure
    if (body.object !== "whatsapp_business_account") {
      console.log("[WA Sales Webhook] Ignoring non-WA object:", body.object);
      return NextResponse.json({ ok: true });
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        if (!value?.messages) continue;

        for (const message of value.messages) {
          // Only handle text messages
          if (message.type !== "text") continue;

          const senderPhone = message.from;
          const messageText = message.text?.body;
          const messageId = message.id;

          if (!senderPhone || !messageText) continue;

          console.log(`[WA Sales Webhook] Message from ${senderPhone}: "${messageText.slice(0, 50)}"`);

          // Mark as read
          if (messageId) {
            await markWhatsAppRead(messageId);
          }

          // Get sender name from contacts
          const senderName =
            value.contacts?.[0]?.profile?.name || senderPhone;

          // Save/update lead
          try {
            await prisma.salesLead.upsert({
              where: { whatsappPhone: senderPhone },
              create: {
                whatsappPhone: senderPhone,
                name: senderName,
                channel: "whatsapp",
                stage: "new",
              },
              update: {
                name: senderName,
                updatedAt: new Date(),
              },
            });
          } catch {
            // Lead upsert failed - might need unique index on whatsappPhone
          }

          // Generate and send AI response
          const aiResponse = await generateAIResponse(
            messageText,
            senderPhone,
            senderName
          );

          await sendWhatsAppMessage(senderPhone, aiResponse);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sales bot WhatsApp webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
