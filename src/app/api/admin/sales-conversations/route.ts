import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const channelFilter = searchParams.get("channel") || "all";
    const leadId = searchParams.get("id");

    // If id is provided, return full conversation history for that lead
    if (leadId) {
      const lead = await prisma.salesLead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        return NextResponse.json({ error: "Лид не найден" }, { status: 404 });
      }

      const history = (lead.history as unknown as HistoryMessage[]) || [];

      return NextResponse.json({
        id: lead.id,
        name: lead.name,
        channel: lead.channel,
        stage: lead.stage,
        telegramUsername: lead.telegramUsername,
        whatsappPhone: lead.whatsappPhone,
        instagramId: lead.instagramId,
        history,
      });
    }

    // Otherwise return list of all conversations with non-empty history
    const where: Record<string, unknown> = {
      NOT: {
        history: { equals: [] },
      },
    };

    if (channelFilter !== "all") {
      where.channel = channelFilter;
    }

    const leads = await prisma.salesLead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        channel: true,
        stage: true,
        history: true,
        updatedAt: true,
        telegramUsername: true,
        whatsappPhone: true,
        instagramId: true,
      },
    });

    const conversations = leads.map((lead) => {
      const history = (lead.history as unknown as HistoryMessage[]) || [];
      const lastMsg = history.length > 0 ? history[history.length - 1] : null;

      return {
        id: lead.id,
        name: lead.name,
        channel: lead.channel,
        stage: lead.stage,
        messageCount: history.length,
        lastMessage: lastMsg ? lastMsg.content.slice(0, 120) : "",
        lastMessageRole: lastMsg?.role || "",
        updatedAt: lead.updatedAt.toISOString(),
        telegramUsername: lead.telegramUsername,
        whatsappPhone: lead.whatsappPhone,
        instagramId: lead.instagramId,
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Admin sales conversations error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
