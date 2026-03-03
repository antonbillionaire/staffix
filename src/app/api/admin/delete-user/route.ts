import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ exists: false, message: "User not found" });
  }
  return NextResponse.json({ exists: true, id: user.id, emailVerified: user.emailVerified, createdAt: user.createdAt });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.delete({ where: { email } });
    return NextResponse.json({ deleted: user.email, id: user.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }
}
