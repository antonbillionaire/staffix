import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { randomBytes } from "crypto";

// GET - получить данные бизнеса текущего пользователя
export async function GET() {
  try {
    // NextAuth session only — cookie fallback removed (security fix)
    const session = await auth();
    let userId: string | undefined;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      userId = user?.id;
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

    // Real stats from database
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [bookingsToday, totalClients] = await Promise.all([
      prisma.booking.count({
        where: {
          businessId: business.id,
          date: { gte: todayStart, lt: todayEnd },
          status: { not: "cancelled" },
        },
      }),
      prisma.client.count({
        where: { businessId: business.id },
      }),
    ]);

    return NextResponse.json({
      business: {
        ...business,
        // Mask sensitive tokens in GET response
        waAccessToken: business.waAccessToken ? "***" : null,
        fbPageAccessToken: business.fbPageAccessToken ? "***" : null,
      },
      stats: { bookingsToday, totalClients },
    });
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

// Helper: Register webhook for the bot with secret_token for signature verification
async function registerWebhook(
  token: string,
  businessId: string
): Promise<{ success: boolean; webhookSecret?: string; error?: string }> {
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.staffix.io'}/api/telegram/webhook?businessId=${businessId}`;

    // Generate a secret token for HMAC verification (Telegram requirement: [A-Za-z0-9_-], 1-256 chars)
    const webhookSecret = randomBytes(32).toString("hex");

    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
        secret_token: webhookSecret,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return { success: true, webhookSecret };
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
    // NextAuth session only — cookie fallback removed (security fix)
    const session = await auth();
    let userId: string | undefined;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { name, phone, address, workingHours, botToken, aiTone, welcomeMessage, aiRules, botLogo, timezone, ownerTelegramUsername, paymeId, clickServiceId, clickMerchantId, kaspiPayLink, waPhoneNumberId, waAccessToken, waVerifyToken, waActive, fbPageId, fbPageAccessToken, fbVerifyToken, fbActive, businessTypes, language, deliveryEnabled, deliveryTimeFrom, deliveryTimeTo, deliveryFee, deliveryFreeFrom, deliveryZones } = data;

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
    if (timezone !== undefined) updateData.timezone = timezone;
    if (ownerTelegramUsername !== undefined) updateData.ownerTelegramUsername = ownerTelegramUsername;
    if (paymeId !== undefined) updateData.paymeId = paymeId || null;
    if (clickServiceId !== undefined) updateData.clickServiceId = clickServiceId || null;
    if (clickMerchantId !== undefined) updateData.clickMerchantId = clickMerchantId || null;
    if (kaspiPayLink !== undefined) updateData.kaspiPayLink = kaspiPayLink || null;

    // Business types, language, delivery
    if (businessTypes !== undefined) updateData.businessTypes = businessTypes;
    if (language !== undefined) updateData.language = language;
    if (deliveryEnabled !== undefined) updateData.deliveryEnabled = Boolean(deliveryEnabled);
    if (deliveryTimeFrom !== undefined) updateData.deliveryTimeFrom = deliveryTimeFrom ? parseInt(deliveryTimeFrom) : null;
    if (deliveryTimeTo !== undefined) updateData.deliveryTimeTo = deliveryTimeTo ? parseInt(deliveryTimeTo) : null;
    if (deliveryFee !== undefined) updateData.deliveryFee = deliveryFee ? parseInt(deliveryFee) : null;
    if (deliveryFreeFrom !== undefined) updateData.deliveryFreeFrom = deliveryFreeFrom ? parseInt(deliveryFreeFrom) : null;
    if (deliveryZones !== undefined) updateData.deliveryZones = deliveryZones || null;

    // WhatsApp
    if (waPhoneNumberId !== undefined) updateData.waPhoneNumberId = waPhoneNumberId || null;
    if (waAccessToken !== undefined) updateData.waAccessToken = waAccessToken || null;
    if (waVerifyToken !== undefined) updateData.waVerifyToken = waVerifyToken || null;
    if (waActive !== undefined) updateData.waActive = Boolean(waActive);

    // Facebook Messenger
    if (fbPageId !== undefined) updateData.fbPageId = fbPageId || null;
    if (fbPageAccessToken !== undefined) updateData.fbPageAccessToken = fbPageAccessToken || null;
    if (fbVerifyToken !== undefined) updateData.fbVerifyToken = fbVerifyToken || null;
    if (fbActive !== undefined) updateData.fbActive = Boolean(fbActive);

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

      // Сохраняем данные бота и webhook secret для верификации
      updateData.botToken = botToken;
      updateData.botUsername = validation.username;
      updateData.botActive = true;
      if (webhookResult.webhookSecret) {
        updateData.webhookSecret = webhookResult.webhookSecret;
      }
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
