import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getSalesSystemPrompt } from "@/lib/sales-bot/system-prompt";
import { sendInstagramMessage, verifyMetaWebhook } from "@/lib/sales-bot/meta-api";

// In-memory conversation history
const conversationHistory: Map<
  string,
  Array<{ role: "user" | "assistant"; content: string }>
> = new Map();

// Generate AI response
async function generateAIResponse(
  userMessage: string,
  senderId: string,
  userName: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "Извините, сервис временно недоступен. Посетите https://staffix.io";
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    let history = conversationHistory.get(senderId) || [];

    if (history.length > 20) {
      history = history.slice(-20);
    }

    history.push({ role: "user", content: userMessage });

    const systemPrompt =
      getSalesSystemPrompt() +
      `\n\nКанал: Instagram DM. Собеседник: ${userName} (ID: ${senderId})`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Извините, не могу обработать ваш запрос.";

    history.push({ role: "assistant", content: assistantMessage });
    conversationHistory.set(senderId, history);

    return assistantMessage;
  } catch (error) {
    console.error("Sales bot Instagram: AI error:", error);
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
  try {
    const body = await request.json();

    // Instagram webhook payload structure
    if (body.object !== "instagram") {
      return NextResponse.json({ ok: true });
    }

    for (const entry of body.entry || []) {
      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const messageText = messaging.message?.text;

        if (!senderId || !messageText) continue;

        // Save/update lead
        try {
          await prisma.salesLead.upsert({
            where: { instagramId: senderId },
            create: {
              instagramId: senderId,
              channel: "instagram",
              stage: "new",
            },
            update: {
              updatedAt: new Date(),
            },
          });
        } catch {
          // Lead upsert failed - might need unique index on instagramId
        }

        // Generate and send AI response
        const aiResponse = await generateAIResponse(
          messageText,
          senderId,
          senderId // Instagram doesn't always provide username in webhook
        );

        await sendInstagramMessage(senderId, aiResponse);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sales bot Instagram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
