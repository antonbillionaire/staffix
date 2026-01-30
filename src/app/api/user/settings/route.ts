import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        theme: true,
        notifyNewBookings: true,
        notifyCancellations: true,
        notifyLowMessages: true,
        notifyTrialEnding: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ settings: user });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (body.theme !== undefined) {
      updateData.theme = body.theme;
    }
    if (body.notifyNewBookings !== undefined) {
      updateData.notifyNewBookings = body.notifyNewBookings;
    }
    if (body.notifyCancellations !== undefined) {
      updateData.notifyCancellations = body.notifyCancellations;
    }
    if (body.notifyLowMessages !== undefined) {
      updateData.notifyLowMessages = body.notifyLowMessages;
    }
    if (body.notifyTrialEnding !== undefined) {
      updateData.notifyTrialEnding = body.notifyTrialEnding;
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        theme: true,
        notifyNewBookings: true,
        notifyCancellations: true,
        notifyLowMessages: true,
        notifyTrialEnding: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: updatedUser,
    });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
