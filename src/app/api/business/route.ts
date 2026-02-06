import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { auth } from "@/auth";

// GET - получить данные бизнеса текущего пользователя
export async function GET() {
  try {
    // Try NextAuth session first
    const session = await auth();
    let userId: string | undefined;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      userId = user?.id;
    }

    // Fallback to cookie-based auth
    if (!userId) {
      const cookieStore = await cookies();
      userId = cookieStore.get("userId")?.value;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { userId },
      include: {
        subscription: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error("Get business error:", error);
    return NextResponse.json(
      { error: "Ошибка получения данных" },
      { status: 500 }
    );
  }
}

// Helper: Validate bot token and get bot info from Telegram
async function validateBotToken(token: string): Promise<{ valid: boolean; username?: string; firstName?: string; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (data.ok) {
      return {
        valid: true,
        username: data.result.username,
        firstName: data.result.first_name,
      };
    }
    return { valid: false, error: data.description || "Неверный токен" };
  } catch {
    return { valid: false, error: "Ошибка проверки токена" };
  }
}

// Helper: Register webhook for the bot
async function registerWebhook(token: string, businessId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://staffix.io'}/api/telegram/webhook?businessId=${businessId}`;

    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return { success: true };
    }
    return { success: false, error: data.description || "Ошибка регистрации webhook" };
  } catch (error) {
    console.error("Webhook registration error:", error);
    return { success: false, error: "Ошибка регистрации webhook" };
  }
}

// PUT - обновить данные бизнеса
export async function PUT(request: Request) {
  try {
    // Try NextAuth session first
    const session = await auth();
    let userId: string | undefined;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      userId = user?.id;
    }

    // Fallback to cookie-based auth
    if (!userId) {
      const cookieStore = await cookies();
      userId = cookieStore.get("userId")?.value;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { name, phone, address, workingHours, botToken, aiTone, welcomeMessage, aiRules, botLogo } = data;

    // Найти бизнес пользователя
    const existingBusiness = await prisma.business.findFirst({
      where: { userId },
    });

    if (!existingBusiness) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    // Подготовить данные для обновления
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (workingHours !== undefined) updateData.workingHours = workingHours;
    if (aiTone !== undefined) updateData.aiTone = aiTone;
    if (welcomeMessage !== undefined) updateData.welcomeMessage = welcomeMessage;
    if (aiRules !== undefined) updateData.aiRules = aiRules;
    if (botLogo !== undefined) updateData.botLogo = botLogo;

    // Если передан токен бота - валидируем и регистрируем/перерегистрируем webhook
    if (botToken) {
      // Валидация токена
      const validation = await validateBotToken(botToken);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Неверный токен бота" },
          { status: 400 }
        );
      }

      // Всегда регистрируем webhook (на случай если он был сброшен)
      const webhookResult = await registerWebhook(botToken, existingBusiness.id);
      if (!webhookResult.success) {
        return NextResponse.json(
          { error: webhookResult.error || "Ошибка активации бота" },
          { status: 400 }
        );
      }

      // Сохраняем данные бота
      updateData.botToken = botToken;
      updateData.botUsername = validation.username;
      updateData.botActive = true;
    }

    // Обновить данные
    const updatedBusiness = await prisma.business.update({
      where: { id: existingBusiness.id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Данные сохранены",
      business: updatedBusiness,
    });
  } catch (error) {
    console.error("Update business error:", error);
    return NextResponse.json(
      { error: "Ошибка сохранения данных" },
      { status: 500 }
    );
  }
}
