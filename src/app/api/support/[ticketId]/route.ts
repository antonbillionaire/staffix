import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

    // Add message and update ticket
    const newMessage = await prisma.supportMessage.create({
      data: {
        content: message,
        isFromSupport: false,
        ticketId,
      },
    });

    // Update ticket status if it was closed or resolved
    if (ticket.status === "closed" || ticket.status === "resolved") {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "open" },
      });
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
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

    const { action } = await request.json();

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
