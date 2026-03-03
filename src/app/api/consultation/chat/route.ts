import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CONSULTATION_SYSTEM_PROMPT } from "@/lib/consultation-prompt";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // DB-based rate limiting: 10 messages per 15 min per IP
    const ip = getClientIp(req);
    const { allowed } = await rateLimit(`consultation:${ip}`, 10, 15);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { messages, language } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Keep only last 20 messages for context
    const recentMessages = messages.slice(-20).map((msg: { role: string; content: string }) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const systemPrompt = language
      ? `${CONSULTATION_SYSTEM_PROMPT}\n\nThe user is writing in "${language}" language. Respond in the same language.`
      : CONSULTATION_SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: recentMessages,
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Sorry, I could not process your request.";

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error("Consultation chat error:", error);
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}
