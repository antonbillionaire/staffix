/**
 * GET /api/dashboard/activity-log
 *
 * Возвращает журнал активности бота для бизнеса текущего пользователя.
 *
 * Изоляция: фильтр всегда по `businessId = currentUser.business.id`.
 * Клиент НЕ может увидеть журнал чужого бизнеса даже если подменит query param —
 * мы не принимаем businessId с клиента, берём из сессии.
 *
 * Параметры:
 *   type      — фильтр по типу события (опционально)
 *   severity  — фильтр по severity (info / warn / error)
 *   limit     — сколько записей отдать (default 50, max 200)
 *   before    — ISO timestamp, отдать записи СТАРШЕ этого (для пагинации вниз)
 *   since     — ISO timestamp, отдать записи НОВЕЕ этого (для polling в реалтайме)
 *   q         — search-substring по summary (опционально)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // ИЗОЛЯЦИЯ: бизнес определяется ТОЛЬКО из сессии, не из query.
    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || null;
    const severity = searchParams.get("severity") || null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const before = searchParams.get("before");
    const since = searchParams.get("since");
    const q = searchParams.get("q")?.trim() || null;

    const where: Record<string, unknown> = {
      businessId: business.id, // KEY: жёсткая изоляция
    };
    if (type) where.type = type;
    if (severity) where.severity = severity;

    // Пагинация / polling
    if (before && since) {
      where.createdAt = { lt: new Date(before), gt: new Date(since) };
    } else if (before) {
      where.createdAt = { lt: new Date(before) };
    } else if (since) {
      where.createdAt = { gt: new Date(since) };
    }

    // Substring search по summary
    if (q) {
      where.summary = { contains: q, mode: "insensitive" };
    }

    const items = await prisma.businessActivityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        severity: true,
        summary: true,
        technical: true,
        channel: true,
        clientId: true,
        staffId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/dashboard/activity-log:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
