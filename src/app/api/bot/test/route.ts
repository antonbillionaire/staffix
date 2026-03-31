import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { buildChannelSystemPrompt } from "@/lib/channel-ai";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/bot/test — test bot response without side effects
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await request.json();
    if (!message || typeof message !== "string" || message.length > 500) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        businessType: true,
        dashboardMode: true,
        phone: true,
        address: true,
        workingHours: true,
        welcomeMessage: true,
        aiTone: true,
        aiRules: true,
        botDisplayName: true,
        language: true,
        city: true,
        country: true,
        services: { select: { name: true, description: true, price: true, duration: true }, take: 50 },
        products: { select: { name: true, description: true, price: true, category: true, stock: true }, take: 50 },
        faqs: { select: { question: true, answer: true }, take: 20 },
        staff: { select: { name: true, role: true }, take: 10 },
        documents: { where: { parsed: true }, select: { name: true, extractedText: true }, take: 5 },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const systemPrompt = buildChannelSystemPrompt(business, "test");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 500,
      system: systemPrompt + "\n\nЭто тестовое сообщение от владельца бизнеса. Отвечай как если бы это был реальный клиент. НЕ используй инструменты (записи, квалификация) — просто ответь текстом.",
      messages: [{ role: "user", content: message }],
    });

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => {
        if (b.type === "text") return b.text;
        return "";
      })
      .join("");

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("POST /api/bot/test:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
