/**
 * GET /api/onboarding/progress
 * Возвращает текущий прогресс онбординга для бизнеса залогиненного пользователя.
 *
 * POST /api/onboarding/progress
 * Помечает онбординг как завершённый (Business.onboardingCompleted = true).
 * Используется кнопкой «Отметить как запущенный» на финальном шаге.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOnboardingProgress } from "@/lib/onboarding-progress";

async function getUserBusinessId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return null;
  const business = await prisma.business.findFirst({ where: { userId: user.id }, select: { id: true } });
  return business?.id ?? null;
}

export async function GET() {
  try {
    const businessId = await getUserBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const progress = await getOnboardingProgress(businessId);
    return NextResponse.json(progress);
  } catch (error) {
    console.error("GET /api/onboarding/progress:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const businessId = await getUserBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const completed = body.completed !== false; // по умолчанию true
    await prisma.business.update({
      where: { id: businessId },
      data: { onboardingCompleted: completed },
    });
    const progress = await getOnboardingProgress(businessId);
    return NextResponse.json(progress);
  } catch (error) {
    console.error("POST /api/onboarding/progress:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
