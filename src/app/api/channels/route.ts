/**
 * API endpoint for managing channel connections
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET - Get all channel connections for user's business
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        businesses: {
          include: {
            channelConnections: true,
          },
        },
      },
    });

    if (!user || !user.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const business = user.businesses[0];
    const connections = business.channelConnections || [];

    // Build channel statuses
    const channels = [];

    // Telegram (from existing bot settings)
    channels.push({
      channel: "telegram",
      isConnected: business.botActive || false,
      isVerified: !!business.botToken,
      details: {
        username: business.botUsername,
      },
      stats: {
        totalMessages: 0, // TODO: Calculate from messages
        totalClients: 0,
        leadsToday: 0,
      },
    });

    // WhatsApp
    const whatsappConnection = connections.find((c) => c.channel === "whatsapp");
    channels.push({
      channel: "whatsapp",
      isConnected: whatsappConnection?.isConnected || false,
      isVerified: whatsappConnection?.isVerified || false,
      details: {
        phoneNumber: whatsappConnection?.whatsappPhoneNumber,
      },
      stats: {
        totalMessages: 0,
        totalClients: 0,
        leadsToday: 0,
      },
    });

    // Instagram
    const instagramConnection = connections.find((c) => c.channel === "instagram");
    channels.push({
      channel: "instagram",
      isConnected: instagramConnection?.isConnected || false,
      isVerified: instagramConnection?.isVerified || false,
      details: {
        username: instagramConnection?.instagramUsername,
      },
      stats: {
        totalMessages: 0,
        totalClients: 0,
        leadsToday: 0,
      },
    });

    // Get stats from ChannelMessage and Lead tables
    // TODO: Implement proper stats calculation

    return NextResponse.json({
      channels,
      webhookBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Ошибка получения каналов" },
      { status: 500 }
    );
  }
}

// POST - Connect a new channel
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    const { channel, ...connectionData } = body;

    if (!channel || !["whatsapp", "instagram"].includes(channel)) {
      return NextResponse.json(
        { error: "Неверный канал" },
        { status: 400 }
      );
    }

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        businesses: true,
      },
    });

    if (!user || !user.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;

    // Upsert channel connection
    const connection = await prisma.channelConnection.upsert({
      where: {
        businessId_channel: {
          businessId,
          channel,
        },
      },
      create: {
        businessId,
        channel,
        isConnected: true,
        ...connectionData,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
      },
      update: {
        isConnected: true,
        ...connectionData,
        lastActivityAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      connection,
    });
  } catch (error) {
    console.error("Error connecting channel:", error);
    return NextResponse.json(
      { error: "Ошибка подключения канала" },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect a channel
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    if (!channel || !["whatsapp", "instagram"].includes(channel)) {
      return NextResponse.json(
        { error: "Неверный канал" },
        { status: 400 }
      );
    }

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        businesses: true,
      },
    });

    if (!user || !user.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;

    // Update connection to disconnected
    await prisma.channelConnection.updateMany({
      where: {
        businessId,
        channel,
      },
      data: {
        isConnected: false,
        metaAccessToken: null,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error disconnecting channel:", error);
    return NextResponse.json(
      { error: "Ошибка отключения канала" },
      { status: 500 }
    );
  }
}
