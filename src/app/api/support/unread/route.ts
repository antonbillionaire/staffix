import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET - Count unread support messages (messages from support that user hasn't seen)
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ count: 0 });
    }

    // Count tickets with unread support messages
    // A ticket is considered "unread" if the last message is from support
    const tickets = await prisma.supportTicket.findMany({
      where: {
        userId: session.user.id,
        status: { not: "closed" },
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const unreadCount = tickets.filter(
      (ticket) => ticket.messages[0]?.isFromSupport === true
    ).length;

    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Unread count error:", error);
    return NextResponse.json({ count: 0 });
  }
}
