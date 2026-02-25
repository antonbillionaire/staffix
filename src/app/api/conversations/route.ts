import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/conversations — list of clients with their last message
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

    // If clientId is provided, return messages for that conversation
    if (clientId) {
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

    // List all conversations grouped by client
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId: business.id,
        ...(search
          ? {
              OR: [
                { clientName: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group by clientTelegramId (one client can have multiple conversations)
    const clientMap = new Map<
      string,
      {
        clientTelegramId: string;
        clientName: string | null;
        lastMessage: string;
        lastMessageRole: string;
        lastMessageAt: string;
        totalMessages: number;
      }
    >();

    for (const conv of conversations) {
      const key = conv.clientTelegramId.toString();
      const existing = clientMap.get(key);
      const lastMsg = conv.messages[0];

      if (!existing || (lastMsg && new Date(lastMsg.createdAt) > new Date(existing.lastMessageAt))) {
        clientMap.set(key, {
          clientTelegramId: key,
          clientName: conv.clientName || existing?.clientName || null,
          lastMessage: lastMsg?.content?.substring(0, 100) || "",
          lastMessageRole: lastMsg?.role || "user",
          lastMessageAt: lastMsg?.createdAt?.toISOString() || conv.updatedAt.toISOString(),
          totalMessages: (existing?.totalMessages || 0) + conv._count.messages,
        });
      } else if (existing) {
        existing.totalMessages += conv._count.messages;
      }
    }

    const clientList = Array.from(clientMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return NextResponse.json({ conversations: clientList });
  } catch (error) {
    console.error("GET /api/conversations:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
