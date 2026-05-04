import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSupportReply, isEscalationResponse } from "@/lib/support-bot-prompt";
import { sendTelegramNotification } from "@/lib/email";

// GET - Fetch a specific ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await auth();
    const { ticketId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Тикет не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Ticket fetch error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

// POST - Add a message to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await auth();
    const { ticketId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Сообщение обязательно" },
        { status: 400 }
      );
    }

    // Verify ticket belongs to user
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Тикет не найден" },
        { status: 404 }
      );
    }

    const newMessage = await prisma.supportMessage.create({
      data: {
        content: message,
        isFromSupport: false,
        ticketId,
      },
    });

    if (ticket.status === "closed" || ticket.status === "resolved") {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "open" },
      });
    }

    // AI авто-ответ на followup. История = все предыдущие сообщения тикета (без только что созданного).
    const previousMessages = await prisma.supportMessage.findMany({
      where: { ticketId, NOT: { id: newMessage.id } },
      orderBy: { createdAt: "asc" },
    });
    const history = previousMessages.map((m) => ({
      role: (m.isFromSupport ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));

    let aiMessage: typeof newMessage | null = null;
    let aiResponse: string | null = null;
    try {
      aiResponse = await generateSupportReply(history, message);
      aiMessage = await prisma.supportMessage.create({
        data: {
          content: aiResponse,
          isFromSupport: true,
          ticketId,
        },
      });

      if (isEscalationResponse(aiResponse)) {
        const shortTicketId = ticketId.slice(-8);
        await sendTelegramNotification(
          `🔔 <b>Эскалация в тикете</b>\n\n` +
          `<b>Тикет:</b> <code>${shortTicketId}</code>\n` +
          `<b>Сообщение клиента:</b>\n${message}\n\n` +
          `💬 <i>Ответить:</i>\n<code>/reply ${shortTicketId} Ваш ответ</code>`
        ).catch((e) => console.error("[support followup] notify failed:", e));
      }
    } catch (e) {
      console.error("[support] AI followup failed:", e);
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
      aiReply: aiMessage,
    });
  } catch (error) {
    console.error("Message create error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

// PATCH - Update ticket (resolve, mark as read)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await auth();
    const { ticketId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { action, rating } = await request.json();

    // Verify ticket belongs to user
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Тикет не найден" },
        { status: 404 }
      );
    }

    // Handle different actions
    if (action === "resolve") {
      // User marks ticket as resolved
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "resolved" },
      });

      return NextResponse.json({ success: true, status: "resolved" });
    }

    if (action === "reopen") {
      // User reopens a resolved ticket
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "open" },
      });

      return NextResponse.json({ success: true, status: "open" });
    }

    if (action === "rate") {
      const r = parseInt(rating, 10);
      if (!r || r < 1 || r > 5) {
        return NextResponse.json({ error: "Оценка от 1 до 5" }, { status: 400 });
      }
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { rating: r },
      });
      return NextResponse.json({ success: true, rating: r });
    }

    if (action === "markAsRead") {
      // Mark all support messages in this ticket as read
      await prisma.supportMessage.updateMany({
        where: {
          ticketId,
          isFromSupport: true,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Неизвестное действие" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Ticket update error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
