/**
 * POST /api/messages/return-to-bot
 *
 * Досрочно снимает human-takeover флаг с конкретного разговора — «Вернуть
 * боту сейчас» из UI, когда менеджер закончил ручной ответ и хочет чтобы
 * бот снова обрабатывал входящие клиента.
 *
 * Body: { clientId: string, channel: "telegram" | "whatsapp" | "instagram" | "facebook" | "web" }
 *
 * Без вызова этого endpoint флаг всё равно протухнет сам по себе через
 * настроенное окно (HUMAN_TAKEOVER_MINUTES, по-умолчанию 30 минут), но
 * кнопка полезна если менеджер закончил быстрее и хочет вернуть бота.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Channel = "telegram" | "whatsapp" | "instagram" | "facebook" | "web" | "messenger";

const CHANNEL_CONV_CHANNELS: Channel[] = [
  "whatsapp",
  "instagram",
  "facebook",
  "web",
  "messenger",
];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { clientId?: string; channel?: Channel };
    const clientId = (body.clientId || "").trim();
    const channel = body.channel as Channel;

    if (!clientId || !channel) {
      return NextResponse.json(
        { error: "Missing clientId or channel" },
        { status: 400 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (channel === "telegram") {
      // Telegram — таблица Conversation, clientId = telegramId (BigInt)
      let telegramId: bigint;
      try {
        telegramId = BigInt(clientId);
      } catch {
        return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
      }
      const conv = await prisma.conversation.findFirst({
        where: { businessId: business.id, clientTelegramId: telegramId },
        select: { id: true },
      });
      if (!conv) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { humanTakeoverUntil: null },
      });
    } else if (CHANNEL_CONV_CHANNELS.includes(channel)) {
      const conv = await prisma.channelConversation.findFirst({
        where: { businessId: business.id, channel, clientId },
        select: { id: true },
      });
      if (!conv) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      await prisma.channelConversation.update({
        where: { id: conv.id },
        data: { humanTakeoverUntil: null },
      });
    } else {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[return-to-bot] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
