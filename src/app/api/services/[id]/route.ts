import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { auth } from "@/auth";

async function getUserId(): Promise<string | null> {
  const session = await auth();

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user?.id) return user.id;
  }

  const cookieStore = await cookies();
  return cookieStore.get("userId")?.value || null;
}

// PUT - обновить услугу
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();
    const { name, price, duration } = data;

    // Verify service belongs to user's business
    const service = await prisma.service.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });

    if (!service || service.business.userId !== userId) {
      return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: name || undefined,
        price: price ? parseInt(price) : undefined,
        duration: duration ? parseInt(duration) : undefined,
      },
    });

    return NextResponse.json({ service: updated });
  } catch (error) {
    console.error("Update service error:", error);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}

// DELETE - удалить услугу
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    // Verify service belongs to user's business
    const service = await prisma.service.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });

    if (!service || service.business.userId !== userId) {
      return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    }

    await prisma.service.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete service error:", error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
