import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptConfig, validateExternalUrl } from "@/lib/crm-integrations";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user?.id) return user.id;
  }
  return null;
}

// GET /api/integrations — список CRM интеграций бизнеса
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    // Проверяем что бизнес принадлежит пользователю
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId },
      select: { id: true, name: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const integrations = await prisma.crmIntegration.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        name: true,
        events: true,
        isActive: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        // config не возвращаем — может содержать токены
      },
    });

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error("GET /api/integrations error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/integrations — создать новую интеграцию
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, type, name, config, events } = body;

    if (!businessId || !type || !name || !config) {
      return NextResponse.json(
        { error: "businessId, type, name, config обязательны" },
        { status: 400 }
      );
    }

    const validTypes = ["webhook", "google_sheets", "bitrix24", "amocrm"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Тип должен быть: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const validEvents = [
      "booking_created",
      "booking_confirmed",
      "booking_cancelled",
      "new_client",
      "review_created",
      "message_received",
    ];
    const sanitizedEvents = (events || []).filter((e: string) =>
      validEvents.includes(e)
    );

    // Проверяем что бизнес принадлежит пользователю
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId },
      select: { id: true, name: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Валидация config по типу
    validateConfig(type, config);

    // Encrypt sensitive fields before storing
    const encryptedConfig = encryptConfig(config);

    const integration = await prisma.crmIntegration.create({
      data: {
        businessId,
        type,
        name,
        config: encryptedConfig as Record<string, string>,
        events: sanitizedEvents,
        isActive: true,
      },
    });

    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/integrations error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ========================================
// Вспомогательные функции
// ========================================

class ConfigValidationError extends Error {}

function validateConfig(type: string, config: Record<string, unknown>): void {
  switch (type) {
    case "webhook":
      if (!config.url || typeof config.url !== "string") {
        throw new ConfigValidationError("Webhook: необходим URL");
      }
      try {
        validateExternalUrl(config.url as string);
      } catch (e) {
        throw new ConfigValidationError(`Webhook: ${e instanceof Error ? e.message : "некорректный URL"}`);
      }
      break;

    case "google_sheets":
      if (!config.spreadsheetId) {
        throw new ConfigValidationError("Google Sheets: необходим spreadsheetId");
      }
      if (!config.credentialsJson) {
        throw new ConfigValidationError(
          "Google Sheets: необходим credentialsJson (сервисный аккаунт)"
        );
      }
      try {
        const creds = JSON.parse(config.credentialsJson as string);
        if (!creds.client_email || !creds.private_key) {
          throw new ConfigValidationError(
            "Google Sheets: credentials должны содержать client_email и private_key"
          );
        }
      } catch (e) {
        if (e instanceof ConfigValidationError) throw e;
        throw new ConfigValidationError("Google Sheets: credentials не является валидным JSON");
      }
      break;

    case "bitrix24":
      if (!config.domain || !config.token) {
        throw new ConfigValidationError(
          "Bitrix24: необходимы domain (например: mycompany.bitrix24.ru) и token (webhook token)"
        );
      }
      if (!/^[\w.-]+\.bitrix24\.\w+$/.test(config.domain as string)) {
        throw new ConfigValidationError(
          "Bitrix24: домен должен быть в формате mycompany.bitrix24.ru"
        );
      }
      break;

    case "amocrm":
      if (!config.domain || !config.token) {
        throw new ConfigValidationError(
          "AmoCRM: необходимы domain (например: mycompany) и token (access token)"
        );
      }
      if (!/^[\w-]+$/.test(config.domain as string)) {
        throw new ConfigValidationError(
          "AmoCRM: домен должен содержать только буквы, цифры и дефис (например: mycompany)"
        );
      }
      break;
  }
}
