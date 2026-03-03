import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserBusiness() {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) return null;

  return prisma.business.findFirst({
    where: { userId },
    select: {
      id: true,
      botToken: true,
      aiRules: true,
      businessType: true,
      dashboardMode: true,
      waPhoneNumberId: true,
      waActive: true,
      igBusinessAccountId: true,
      fbPageId: true,
      fbActive: true,
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

    const botConnected = !!business.botToken;
    const waConnected = !!(business.waPhoneNumberId && business.waActive);
    const metaConnected = !!(business.igBusinessAccountId || (business.fbPageId && business.fbActive));
    const hasCatalog = business._count.services + business._count.products > 0;
    const hasStaff = business._count.staff > 0;
    const hasKnowledge = business._count.faqs + business._count.documents > 0;

    // Минимальная настройка: хотя бы 1 канал + хотя бы 1 услуга/товар
    const hasAnyChannel = botConnected || waConnected || metaConnected;
    const minSetupComplete = hasAnyChannel && hasCatalog;

    return NextResponse.json({
      botConnected,
      waConnected,
      metaConnected,
      hasCatalog,
      hasStaff,
      hasKnowledge,
      minSetupComplete,
      businessType: business.businessType || null,
      dashboardMode: business.dashboardMode || "service",
    });
  } catch (error) {
    console.error("GET /api/onboarding/status:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
