/**
 * GET /api/products/enrichment-status
 *
 * Возвращает прогресс автоматического обогащения каталога — сколько товаров
 * уже имеют теги, сколько ещё ждут cron'а. Используется плашкой прогресса
 * на /dashboard/products, чтобы пользователь не нажимал «Обогатить» вручную
 * и понимал что в фоне всё идёт.
 *
 * «Обогащённый» = у товара tags не пустой массив. Совпадает с критерием
 * cron'а /api/cron/enrich-catalog — там фильтр `tags: { isEmpty: true }`.
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

    // Cron работает каждые 30 минут и обогащает до 30 товаров на бизнес —
    // примерно 1 товар в минуту в среднем. Округляем вверх до часов.
    const estimatedMinutes = remaining;
    const estimatedHours = Math.ceil(estimatedMinutes / 60);

    return NextResponse.json({
      total,
      enriched,
      remaining,
      isComplete: remaining === 0 && total > 0,
      estimatedHours: remaining > 0 ? estimatedHours : 0,
    });
  } catch (error) {
    console.error("GET /api/products/enrichment-status:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
