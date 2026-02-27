import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptConfig } from "@/lib/crm-integrations";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user?.id) return user.id;
  }
  const cookieStore = await cookies();
  return cookieStore.get("userId")?.value || null;
}

// PATCH /api/integrations/[id] — обновить (toggle active, events, name)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Находим интеграцию и проверяем доступ
    const integration = await prisma.crmIntegration.findUnique({
      where: { id },
      include: {
        business: { select: { userId: true } },
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (integration.business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;
    if (body.name) updateData.name = body.name;
    if (Array.isArray(body.events)) updateData.events = body.events;
    if (body.config) updateData.config = encryptConfig(body.config);

    const updated = await prisma.crmIntegration.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ integration: updated });
  } catch (error) {
    console.error("PATCH /api/integrations/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/integrations/[id] — удалить интеграцию
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const integration = await prisma.crmIntegration.findUnique({
      where: { id },
      include: {
        business: { select: { userId: true } },
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (integration.business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.crmIntegration.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/integrations/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
