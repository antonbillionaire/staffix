import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import {
  maskName,
  maskPhone,
  maskNumericId,
  maskPiiInText,
} from "@/lib/admin-mask";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

/**
 * GET /api/admin/conversations
 *   — список бизнесов с агрегатами (бизнесы у которых есть переписка)
 *
 * GET /api/admin/conversations?businessId=X
 *   — список диалогов этого бизнеса (TG-основной + WA/IG/FB), отсортирован по lastActivity
 *
 * GET /api/admin/conversations?conversationId=Y&type=tg|channel
 *   — лента сообщений конкретного диалога
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const conversationId = searchParams.get("conversationId");
    const type = searchParams.get("type"); // "tg" | "channel"

    // ─── Режим 3: лента сообщений конкретного диалога ───────────────────
    if (conversationId && type) {
      if (type === "tg") {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            clientName: true,
            clientTelegramId: true,
            businessId: true,
            createdAt: true,
            updatedAt: true,
            messageCount: true,
            summary: true,
            topic: true,
            outcome: true,
            business: { select: { name: true } },
          },
        });
        if (!conv) {
          return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
        }

        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        });

        return NextResponse.json({
          conversation: {
            id: conv.id,
            channel: "telegram",
            clientName: maskName(conv.clientName),
            clientId: maskNumericId(conv.clientTelegramId.toString()),
            businessName: conv.business.name,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messageCount: conv.messageCount,
            summary: conv.summary,
            topic: conv.topic,
            outcome: conv.outcome,
          },
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: maskPiiInText(m.content),
            createdAt: m.createdAt,
          })),
        });
      }

      if (type === "channel") {
        const conv = await prisma.channelConversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            channel: true,
            clientId: true,
            clientName: true,
            history: true,
            messageCount: true,
            summary: true,
            topic: true,
            outcome: true,
            createdAt: true,
            updatedAt: true,
            business: { select: { name: true } },
          },
        });
        if (!conv) {
          return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
        }

        const history = (conv.history as unknown as HistoryMessage[]) || [];
        const isPhone = conv.channel === "whatsapp";

        return NextResponse.json({
          conversation: {
            id: conv.id,
            channel: conv.channel,
            clientName: maskName(conv.clientName),
            clientId: isPhone ? maskPhone(conv.clientId) : maskNumericId(conv.clientId),
            businessName: conv.business.name,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messageCount: conv.messageCount,
            summary: conv.summary,
            topic: conv.topic,
            outcome: conv.outcome,
          },
          messages: history.map((m, i) => ({
            id: `${conv.id}-${i}`,
            role: m.role,
            content: maskPiiInText(m.content),
            createdAt: m.ts || conv.updatedAt,
          })),
        });
      }

      return NextResponse.json({ error: "Неверный type" }, { status: 400 });
    }

    // ─── Режим 2: диалоги конкретного бизнеса ───────────────────────────
    if (businessId) {
      const [tgConvs, channelConvs] = await Promise.all([
        prisma.conversation.findMany({
          where: { businessId },
          orderBy: { updatedAt: "desc" },
          take: 200,
          select: {
            id: true,
            clientName: true,
            clientTelegramId: true,
            messageCount: true,
            updatedAt: true,
            createdAt: true,
            outcome: true,
          },
        }),
        prisma.channelConversation.findMany({
          where: { businessId },
          orderBy: { updatedAt: "desc" },
          take: 200,
          select: {
            id: true,
            channel: true,
            clientId: true,
            clientName: true,
            messageCount: true,
            updatedAt: true,
            createdAt: true,
            outcome: true,
          },
        }),
      ]);

      const items = [
        ...tgConvs.map((c) => ({
          id: c.id,
          type: "tg" as const,
          channel: "telegram",
          clientName: maskName(c.clientName),
          clientId: maskNumericId(c.clientTelegramId.toString()),
          messageCount: c.messageCount,
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
          outcome: c.outcome,
        })),
        ...channelConvs.map((c) => ({
          id: c.id,
          type: "channel" as const,
          channel: c.channel,
          clientName: maskName(c.clientName),
          clientId: c.channel === "whatsapp" ? maskPhone(c.clientId) : maskNumericId(c.clientId),
          messageCount: c.messageCount,
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
          outcome: c.outcome,
        })),
      ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return NextResponse.json({ conversations: items });
    }

    // ─── Режим 1: список бизнесов с агрегатами ──────────────────────────
    // Считаем количество диалогов и сообщений отдельно, без N+1.
    const businesses = await prisma.business.findMany({
      where: {
        OR: [
          { conversations: { some: {} } },
          { channelConversations: { some: {} } },
        ],
      },
      select: {
        id: true,
        name: true,
        businessType: true,
        dashboardMode: true,
        country: true,
        _count: {
          select: {
            conversations: true,
            channelConversations: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    // Самая свежая активность по каждому бизнесу — одной парой запросов.
    const businessIds = businesses.map((b) => b.id);
    const [tgRecent, channelRecent] = await Promise.all([
      prisma.conversation.groupBy({
        by: ["businessId"],
        where: { businessId: { in: businessIds } },
        _max: { updatedAt: true },
        _sum: { messageCount: true },
      }),
      prisma.channelConversation.groupBy({
        by: ["businessId"],
        where: { businessId: { in: businessIds } },
        _max: { updatedAt: true },
        _sum: { messageCount: true },
      }),
    ]);

    const tgMap = new Map(tgRecent.map((r) => [r.businessId, r]));
    const channelMap = new Map(channelRecent.map((r) => [r.businessId, r]));

    const result = businesses
      .map((b) => {
        const tg = tgMap.get(b.id);
        const ch = channelMap.get(b.id);
        const lastActivity = [tg?._max.updatedAt, ch?._max.updatedAt]
          .filter((d): d is Date => Boolean(d))
          .sort((a, z) => z.getTime() - a.getTime())[0] ?? null;
        return {
          id: b.id,
          name: b.name,
          businessType: b.businessType,
          dashboardMode: b.dashboardMode,
          country: b.country,
          conversationCount:
            b._count.conversations + b._count.channelConversations,
          messageCount:
            (tg?._sum.messageCount ?? 0) + (ch?._sum.messageCount ?? 0),
          lastActivity,
        };
      })
      .sort((a, b) => {
        const aT = a.lastActivity ? a.lastActivity.getTime() : 0;
        const bT = b.lastActivity ? b.lastActivity.getTime() : 0;
        return bT - aT;
      });

    return NextResponse.json({ businesses: result });
  } catch (error) {
    console.error("GET /api/admin/conversations:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
