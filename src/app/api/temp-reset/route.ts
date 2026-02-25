import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Temporary endpoint to reset onboarding for a specific user
// Will be deleted after use
const SECRET = "xK9mReset2026feb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const email = "info.lashop.uz@gmail.com";

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const business = await prisma.business.findFirst({
    where: { userId: user.id },
    select: { id: true, businessType: true, onboardingCompleted: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  await prisma.business.update({
    where: { id: business.id },
    data: {
      onboardingCompleted: false,
      businessType: null,
      businessTypes: [],
    },
  });

  return NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, email },
    business: { id: business.id, previousType: business.businessType },
    message: "Onboarding reset — user will go through onboarding again",
  });
}
