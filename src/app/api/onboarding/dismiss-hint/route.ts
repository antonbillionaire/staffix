/**
 * POST /api/onboarding/dismiss-hint
 * Body: { pageId: string }
 *
 * Скрывает баннер вручную — добавляет pageId в Business.hintsDismissed.
 * Идемпотентно (повторный dismiss не даёт дубль).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";
import { HINTS, type PageHintId } from "@/lib/onboarding-hints";

const VALID_IDS = new Set(Object.keys(HINTS));

export async function POST(request: NextRequest) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let body: { pageId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const pageId = body.pageId?.trim() ?? "";
  if (!VALID_IDS.has(pageId)) {
    return NextResponse.json({ error: "Unknown pageId" }, { status: 400 });
  }

  // Идемпотентно: если уже в массиве — не добавляем повторно.
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { hintsDismissed: true },
  });
  const current = biz?.hintsDismissed ?? [];
  if (current.includes(pageId)) {
    return NextResponse.json({ ok: true, alreadyDismissed: true });
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { hintsDismissed: { push: pageId as PageHintId } },
  });
  return NextResponse.json({ ok: true });
}
