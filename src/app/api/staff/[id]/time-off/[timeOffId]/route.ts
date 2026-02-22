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

// DELETE — удалить отгул
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; timeOffId: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id, timeOffId } = await params;

    // Verify ownership
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });

    if (!staff || staff.business.userId !== userId) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    await prisma.staffTimeOff.delete({
      where: { id: timeOffId, staffId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete time-off error:", error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
