import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface UnifiedConversation {
  clientId: string;
  clientName: string | null;
  channel: "telegram" | "whatsapp" | "instagram" | "facebook";
  lastMessage: string;
  lastMessageRole: string;
  lastMessageAt: string;
  totalMessages: number;
}

// GET /api/conversations — unified list across all channels
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ conversations: [] });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const clientId = searchParams.get("clientId");
    const channel = searchParams.get("channel") as string | null;

    // Detail view: return messages for a specific conversation
    if (clientId && channel) {
      // Validate clientId for Telegram (must be numeric for BigInt)
      if (channel === "telegram" && !/^\d+$/.test(clientId)) {
        return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
      }

      // Channel conversation (WA/IG/FB)
      if (channel !== "telegram") {
        const conv = await prisma.channelConversation.findFirst({
          where: {
            businessId: business.id,
            channel,
            clientId,
          },
        });

        if (!conv) {
          return NextResponse.json({ messages: [], clientName: null });
        }

        // History is stored as JSON array [{role, content}]
        const history = (conv.history as Array<{ role: string; content: string }>) || [];
        return NextResponse.json({
          messages: history.map((m, idx) => ({
            id: `${conv.id}-${idx}`,
            role: m.role,
            content: m.content,
            createdAt: conv.updatedAt.toISOString(), // approximate
          })),
          conversationId: conv.id,
          clientName: conv.clientName,
        });
      }

      // Telegram conversation
      const conversation = await prisma.conversation.findFirst({
        where: {
          businessId: business.id,
          clientTelegramId: BigInt(clientId),
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 100,
          },
        },
      });

      if (!conversation) {
        return NextResponse.json({ messages: [] });
      }

      return NextResponse.json({
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
        conversationId: conversation.id,
        clientName: conversation.clientName,
      });
    }

    // Backwards compatibility: clientId without channel = Telegram
    if (clientId && !channel) {
      if (!/^\d+$/.test(clientId)) {
        return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
      }
      const conversation = await prisma.conversation.findFirst({
        where: {
          businessId: business.id,
          clientTelegramId: BigInt(clientId),
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 100,
          },
        },
      });

      if (!conversation) {
        return NextResponse.json({ messages: [] });
      }

      return NextResponse.json({
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
        conversationId: conversation.id,
        clientName: conversation.clientName,
      });
    }

    // ========== LIST ALL CONVERSATIONS ==========

    const allConversations: UnifiedConversation[] = [];

    // 1. Telegram conversations
    const telegramConvs = await prisma.conversation.findMany({
      where: {
        businessId: business.id,
        ...(search
          ? { clientName: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group Telegram by client
    const tgMap = new Map<string, UnifiedConversation>();
    for (const conv of telegramConvs) {
      const key = conv.clientTelegramId.toString();
      const existing = tgMap.get(key);
      const lastMsg = conv.messages[0];

      if (!existing || (lastMsg && new Date(lastMsg.createdAt) > new Date(existing.lastMessageAt))) {
        tgMap.set(key, {
          clientId: key,
          clientName: conv.clientName || existing?.clientName || null,
          channel: "telegram",
          lastMessage: lastMsg?.content?.substring(0, 100) || "",
          lastMessageRole: lastMsg?.role || "user",
          lastMessageAt: lastMsg?.createdAt?.toISOString() || conv.updatedAt.toISOString(),
          totalMessages: (existing?.totalMessages || 0) + conv._count.messages,
        });
      } else if (existing) {
        existing.totalMessages += conv._count.messages;
      }
    }
    allConversations.push(...tgMap.values());

    // 2. Channel conversations (WA/IG/FB)
    const channelConvs = await prisma.channelConversation.findMany({
      where: {
        businessId: business.id,
        ...(search
          ? { clientName: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    for (const conv of channelConvs) {
      const history = (conv.history as Array<{ role: string; content: string }>) || [];
      const lastMsg = history[history.length - 1];

      allConversations.push({
        clientId: conv.clientId,
        clientName: conv.clientName,
        channel: conv.channel as "whatsapp" | "instagram" | "facebook",
        lastMessage: lastMsg?.content?.substring(0, 100) || "",
        lastMessageRole: lastMsg?.role || "user",
        lastMessageAt: conv.updatedAt.toISOString(),
        totalMessages: conv.messageCount || history.length,
      });
    }

    // Sort all by last message time
    allConversations.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    // Filter by channel if specified
    const filtered = channel
      ? allConversations.filter((c) => c.channel === channel)
      : allConversations;

    return NextResponse.json({ conversations: filtered });
  } catch (error) {
    console.error("GET /api/conversations:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
