import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getSalesSystemPrompt } from "@/lib/sales-bot/system-prompt";
import {
  sendInstagramMessage,
  sendPrivateReply,
  markMessageSeen,
  showTypingIndicator,
  verifyMetaWebhook,
} from "@/lib/sales-bot/meta-api";

// In-memory conversation history (keyed by Instagram-scoped user ID)
const conversationHistory: Map<
  string,
  Array<{ role: "user" | "assistant"; content: string }>
> = new Map();

// Generate AI response for any Instagram interaction
async function generateAIResponse(
  userMessage: string,
  senderId: string,
  context: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "Привет! Посетите https://staffix.io для получения информации.";
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    let history = conversationHistory.get(senderId) || [];

    if (history.length > 20) {
      history = history.slice(-20);
    }

    history.push({ role: "user", content: userMessage });

    const systemPrompt =
      getSalesSystemPrompt() + `\n\nКанал: ${context}. ID собеседника: ${senderId}`;

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

// Save/update lead in DB
async function upsertLead(
  instagramId: string,
  channel: string,
  name?: string
) {
  try {
    await prisma.salesLead.upsert({
      where: { instagramId },
      create: {
        instagramId,
        channel,
        name: name || null,
        stage: "new",
      },
      update: {
        updatedAt: new Date(),
      },
    });
  } catch {
    // Ignore upsert errors (e.g. missing unique index)
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

    // Accept both instagram and page object types
    if (body.object !== "instagram" && body.object !== "page") {
      return NextResponse.json({ ok: true });
    }

    for (const entry of body.entry || []) {
      // ─────────────────────────────────────────────
      // 1. Direct Messages (messaging array)
      // ─────────────────────────────────────────────
      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const messageText = messaging.message?.text;

        if (!senderId || !messageText) continue;

        await upsertLead(senderId, "instagram_dm");

        // UX: mark as seen immediately, then show typing while generating
        await markMessageSeen(senderId);
        await showTypingIndicator(senderId);

        const aiResponse = await generateAIResponse(
          messageText,
          senderId,
          "Instagram DM"
        );

        await sendInstagramMessage(senderId, aiResponse);
      }

      // ─────────────────────────────────────────────
      // 2. Comments on posts, Reels, ads (changes array with field=comments)
      // Requires: instagram_manage_comments + pages_messaging + Advanced Access
      // ─────────────────────────────────────────────
      for (const change of entry.changes || []) {
        if (change.field !== "comments" && change.field !== "live_comments") {
          continue;
        }

        const value = change.value;
        if (!value) continue;

        const commentId = value.id;
        const commentText = value.text;
        const commenterId = value.from?.id;
        const commenterName = value.from?.name;
        const isAdComment = !!value.ad_id; // ad comment has ad_id field

        if (!commentId || !commentText || !commenterId) continue;

        // Skip replies to our own comments (prevent loops)
        if (value.parent_id) continue;

        const contextLabel = isAdComment
          ? `Instagram Ad Comment (ad: ${value.ad_title || value.ad_id})`
          : change.field === "live_comments"
          ? "Instagram Live Comment"
          : "Instagram Post Comment";

        await upsertLead(commenterId, "instagram_comment", commenterName);

        // Generate a short, friendly private reply
        const aiResponse = await generateAIResponse(
          commentText,
          commenterId,
          contextLabel
        );

        // Send as private DM reply to the comment (7-day window)
        await sendPrivateReply(commentId, aiResponse);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sales bot Instagram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
