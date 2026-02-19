// Temporary diagnostic endpoint - DELETE AFTER USE
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.DEMO_SECRET || "paypro-demo-2025";

export async function POST(request: NextRequest) {
  const { secret, email } = await request.json();
  if (secret !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      businesses: {
        include: {
          staff: true,
          subscription: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" });
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    businessCount: user.businesses.length,
    businesses: user.businesses.map((b) => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt,
      staffCount: b.staff.length,
      staff: b.staff.map((s) => ({ id: s.id, name: s.name })),
      plan: b.subscription?.plan,
    })),
  });
}
