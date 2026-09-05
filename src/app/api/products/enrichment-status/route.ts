/**
 * GET /api/products/enrichment-status
 *
 * Возвращает сколько товаров обогащено, сколько ещё нет. Используется
 * плашкой на /dashboard/products, которая подсказывает владельцу нажать
 * кнопку «Обогатить каталог».
 *
 * До 5 сент 2026: cron /api/cron/enrich-catalog обогащал автоматически
 * каждые 30 минут, плашка показывала "готово через ~N часов". Cron убран
 * (взорвал Haiku расход $11/день 3-4 сент), обогащение теперь только
 * ручное — плашка стала подсказкой «нажмите кнопку», без ETA.
 *
 * «Обогащённый» = у товара tags не пустой массив.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const [total, enriched] = await Promise.all([
      prisma.product.count({ where: { businessId, isActive: true } }),
      prisma.product.count({
        where: { businessId, isActive: true, NOT: { tags: { isEmpty: true } } },
      }),
    ]);

    const remaining = Math.max(0, total - enriched);

    return NextResponse.json({
      total,
      enriched,
      remaining,
      isComplete: remaining === 0 && total > 0,
    });
  } catch (error) {
    console.error("GET /api/products/enrichment-status:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
