import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  sendSupportTicketNotification,
  sendTelegramNotification,
} from "@/lib/email";
import { generateSupportReply, isEscalationResponse } from "@/lib/support-bot-prompt";

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

    const ticketPriority = priority || "normal";
    const priorityEmoji = ticketPriority === "high" ? "🔴" : ticketPriority === "low" ? "🟢" : "🟡";
    const shortTicketId = ticket.id.slice(-8);

    // AI авто-ответ на новый тикет — пользователь видит его сразу в /dashboard/support.
    // Контекст: subject + message склеены в одно сообщение для лучшего ответа.
    const userPrompt = subject ? `Тема: ${subject}\n\n${message}` : message;
    let aiResponse: string | null = null;
    let aiEscalated = false;
    try {
      aiResponse = await generateSupportReply([], userPrompt);
      aiEscalated = isEscalationResponse(aiResponse);
      await prisma.supportMessage.create({
        data: {
          content: aiResponse,
          isFromSupport: true,
          ticketId: ticket.id,
        },
      });
    } catch (e) {
      console.error("[support] AI auto-reply failed:", e);
    }

    // Уведомления админу и email — только если AI решил эскалировать ИЛИ если AI сломался.
    // Если AI закрыл вопрос сам — не дёргаем Антона по пустякам.
    const shouldNotifyAdmin = aiEscalated || !aiResponse;
    if (shouldNotifyAdmin) {
      const adminNote = aiEscalated
        ? "🔔 AI эскалировал — нужен живой ответ."
        : "⚠️ AI авто-ответ не сработал — нужен ручной ответ.";

      await Promise.allSettled([
        sendSupportTicketNotification(
          ticket.id,
          subject,
          message,
          user?.email || session.user.email || "unknown",
          user?.name || "Пользователь",
          ticketPriority
        ),
        sendTelegramNotification(
          `${priorityEmoji} <b>Новое обращение в поддержку</b>\n\n` +
          `<b>Тикет:</b> <code>${shortTicketId}</code>\n` +
          `<b>От:</b> ${user?.name || "Пользователь"}\n` +
          `<b>Email:</b> ${user?.email || "N/A"}\n` +
          `<b>Тема:</b> ${subject}\n\n` +
          `<b>Сообщение:</b>\n${message}\n\n` +
          `${adminNote}\n\n` +
          `💬 <i>Ответить:</i>\n<code>/reply ${shortTicketId} Ваш ответ</code>`
        ),
      ]).then((results) => {
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(`Notification ${index} failed:`, result.reason);
          }
        });
      });
    }

    // Возвращаем тикет с AI-ответом, чтобы фронт сразу его показал
    const fresh = await prisma.supportTicket.findUnique({
      where: { id: ticket.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({
      success: true,
      ticket: fresh || ticket,
    });
  } catch (error) {
    console.error("Support ticket create error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
