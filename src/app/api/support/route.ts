import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
