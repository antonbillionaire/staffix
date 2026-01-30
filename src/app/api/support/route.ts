import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  sendSupportTicketNotification,
  sendTelegramNotification,
} from "@/lib/email";

// GET - Fetch all support tickets for user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { userId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Support tickets fetch error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { subject, message, priority } = await request.json();

    if (!subject || !message) {
      return NextResponse.json(
        { error: "Тема и сообщение обязательны" },
        { status: 400 }
      );
    }

    // Get user info for notification
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });

    const ticket = await prisma.supportTicket.create({
      data: {
        subject,
        priority: priority || "normal",
        userId: session.user.id,
        messages: {
          create: {
            content: message,
            isFromSupport: false,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    // Send notifications (don't await to not block response)
    const ticketPriority = priority || "normal";

    // Email notification
    sendSupportTicketNotification(
      ticket.id,
      subject,
      message,
      user?.email || session.user.email || "unknown",
      user?.name || "Пользователь",
      ticketPriority
    ).catch((err) => console.error("Email notification failed:", err));

    // Telegram notification
    const priorityEmoji = ticketPriority === "high" ? "🔴" : ticketPriority === "low" ? "🟢" : "🟡";
    sendTelegramNotification(
      `${priorityEmoji} <b>Новое обращение в поддержку</b>\n\n` +
      `<b>От:</b> ${user?.name || "Пользователь"}\n` +
      `<b>Email:</b> ${user?.email || "N/A"}\n` +
      `<b>Тема:</b> ${subject}\n\n` +
      `<b>Сообщение:</b>\n${message}`
    ).catch((err) => console.error("Telegram notification failed:", err));

    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("Support ticket create error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
