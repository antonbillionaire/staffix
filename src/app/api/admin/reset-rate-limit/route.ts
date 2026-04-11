import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delete all login rate limit entries
  const deleted = await prisma.rateLimitEntry.deleteMany({
    where: { key: { startsWith: "login:" } },
  });

  return NextResponse.json({ success: true, deleted: deleted.count });
}
