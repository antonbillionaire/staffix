import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTestCrmEvent, dispatchCrmEvent } from "@/lib/crm-integrations";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user?.id) return user.id;
  }
  const cookieStore = await cookies();
  return cookieStore.get("userId")?.value || null;
}

// POST /api/integrations/test — отправить тестовое событие
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { integrationId } = await request.json();

    if (!integrationId) {
      return NextResponse.json({ error: "integrationId required" }, { status: 400 });
    }

    const integration = await prisma.crmIntegration.findUnique({
      where: { id: integrationId },
      include: {
        business: { select: { userId: true, name: true } },
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    if (integration.business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Отправляем тестовое событие
    const testEvent = buildTestCrmEvent(integration.business.name);

    // Временно добавляем "booking_created" в события если не установлено
    const originalEvents = integration.events;
    if (!originalEvents.includes("booking_created")) {
      await prisma.crmIntegration.update({
        where: { id: integrationId },
        data: { events: [...originalEvents, "booking_created"] },
      });
    }

    await dispatchCrmEvent(integration.businessId, "booking_created", {
      client: testEvent.client,
      booking: testEvent.booking,
    });

    // Восстанавливаем оригинальный список событий
    if (!originalEvents.includes("booking_created")) {
      await prisma.crmIntegration.update({
        where: { id: integrationId },
        data: { events: originalEvents },
      });
    }

    // Читаем финальный статус
    const updated = await prisma.crmIntegration.findUnique({
      where: { id: integrationId },
      select: { lastSyncAt: true, lastError: true },
    });

    if (updated?.lastError) {
      return NextResponse.json(
        { success: false, error: updated.lastError },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, sentAt: updated?.lastSyncAt });
  } catch (error) {
    console.error("POST /api/integrations/test error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
