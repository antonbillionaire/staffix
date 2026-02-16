import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { auth } from "@/auth";

// GET - количество непрочитанных уведомлений
export async function GET() {
  try {
    const session = await auth();
    let userId: string | undefined;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      userId = user?.id;
    }

    if (!userId) {
      const cookieStore = await cookies();
      userId = cookieStore.get("userId")?.value;
    }

    if (!userId) {
      return NextResponse.json({ count: 0 });
    }

    const business = await prisma.business.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.notification.count({
      where: { businessId: business.id, isRead: false },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Unread count error:", error);
    return NextResponse.json({ count: 0 });
  }
}
