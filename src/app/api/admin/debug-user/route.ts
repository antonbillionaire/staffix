import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, password } = await request.json();

  // Try both cases
  const userLower = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  const userOriginal = await prisma.user.findUnique({ where: { email: email.trim() } });

  const user = userLower || userOriginal;

  if (!user) {
    return NextResponse.json({ error: "NOT FOUND", triedLower: email.toLowerCase().trim(), triedOriginal: email.trim() });
  }

  const result: Record<string, unknown> = {
    id: user.id,
    emailInDB: user.email,
    emailVerified: user.emailVerified,
    hasPassword: !!user.password,
    passwordLength: user.password?.length || 0,
    createdAt: user.createdAt,
  };

  // Test password if provided
  if (password && user.password) {
    result.passwordMatch = await bcrypt.compare(password, user.password);
  }

  return NextResponse.json(result);
}
