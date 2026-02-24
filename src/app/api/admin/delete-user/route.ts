import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ONE-TIME endpoint — DELETE AFTER USE
const SECRET = "staffix_admin_del_2025";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const email = req.nextUrl.searchParams.get("email");

  if (secret !== SECRET || !email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ exists: false, message: "User not found" });
  }
  return NextResponse.json({ exists: true, id: user.id, emailVerified: user.emailVerified, createdAt: user.createdAt });
}

export async function DELETE(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const email = req.nextUrl.searchParams.get("email");

  if (secret !== SECRET || !email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const user = await prisma.user.delete({ where: { email } });
    return NextResponse.json({ deleted: user.email, id: user.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }
}
