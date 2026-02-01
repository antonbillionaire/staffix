import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET - Count unread support messages (messages from support that user hasn't read)
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ count: 0 });
    }

    // Count actual unread messages from support
    const unreadCount = await prisma.supportMessage.count({
      where: {
        isFromSupport: true,
        isRead: false,
        ticket: {
          userId: session.user.id,
          status: { notIn: ["closed", "resolved"] },
        },
      },
    });

    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Unread count error:", error);
    return NextResponse.json({ count: 0 });
  }
}
