import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/services/bulk-delete — удалить все услуги бизнеса
export async function DELETE() {
  try {
    const session = await auth();
    let userId: string | null = null;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      userId = user?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const result = await prisma.service.deleteMany({
      where: { businessId: business.id },
    });

    return NextResponse.json({
      message: `Удалено ${result.count} услуг`,
      count: result.count,
    });
  } catch (error) {
    console.error("Bulk delete services error:", error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
