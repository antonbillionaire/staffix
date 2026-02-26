import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserBusiness() {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) {
    const cookieStore = await cookies();
    userId = cookieStore.get("userId")?.value || null;
  }

  if (!userId) return null;

  return prisma.business.findFirst({
    where: { userId },
    select: {
      id: true,
      botToken: true,
      aiRules: true,
      businessType: true,
      _count: {
        select: {
          services: true,
          products: true,
          staff: true,
          faqs: true,
          documents: true,
        },
      },
    },
  });
}

// GET /api/onboarding/status
export async function GET() {
  try {
    const business = await getUserBusiness();
    if (!business) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      botConnected: !!business.botToken,
      hasCatalog: business._count.services + business._count.products > 0,
      hasStaff: business._count.staff > 0,
      hasKnowledge: business._count.faqs + business._count.documents > 0,
      hasPrompt: !!business.aiRules && business.aiRules.trim().length > 10,
      businessType: business.businessType || null,
    });
  } catch (error) {
    console.error("GET /api/onboarding/status:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
