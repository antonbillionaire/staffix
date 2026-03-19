import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// DELETE — disconnect Telegram bot
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const business = await prisma.business.findFirst({ where: { userId: user.id } });
    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    // Delete webhook from Telegram before clearing the token
    if (business.botToken) {
      try {
        await fetch(`https://api.telegram.org/bot${business.botToken}/deleteWebhook`, {
          method: "POST",
        });
      } catch {
        // Non-critical: proceed even if Telegram is unreachable
      }
    }

    // Clear all Telegram bot fields in DB
    await prisma.business.update({
      where: { id: business.id },
      data: {
        botToken: null,
        botUsername: null,
        botActive: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram disconnect error:", error);
    return NextResponse.json({ error: "Ошибка отключения бота" }, { status: 500 });
  }
}
