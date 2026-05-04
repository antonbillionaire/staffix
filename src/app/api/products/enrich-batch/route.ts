/**
 * POST /api/products/enrich-batch
 *
 * Берёт пачку необогащённых товаров и пропускает через catalog-enricher.
 * Признак необогащённого: tags пустой ИЛИ description пустой ИЛИ description
 * на латинице, когда бизнес работает на русском.
 *
 * Параметры (query):
 *   limit — сколько товаров обработать за один вызов (default 30, max 100)
 *
 * Использование из UI: фронтенд вызывает в цикле пока remaining > 0.
 * Каждый вызов укладывается в Vercel timeout (~30 товаров × ~1.5с = 45с).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enrichProduct } from "@/lib/catalog-enricher";
import { markBusinessConversationsForRefresh } from "@/lib/knowledge-refresh";

export const maxDuration = 60;

async function getUserBusiness(): Promise<{ id: string; language: string | null } | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businesses: { select: { id: true, language: true } } },
  });
  return user?.businesses[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    const business = await getUserBusiness();
    if (!business) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Дефолт 12: при ~3с/товар укладывается в Vercel timeout 60с с запасом.
    // Раньше было 30 — большие каталоги (4000+ товаров) ловили timeout.
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 30);

    // Кандидаты — товары без тегов (ключевой признак необогащения).
    // Дополнительно: tags пуст ИЛИ имеет меньше 3 элементов.
    const candidates = await prisma.product.findMany({
      where: {
        businessId: business.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        tags: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500, // выгребаем больше, фильтруем в коде
    });

    // Фильтрация: считаем что обогащённый продукт имеет >=3 тегов
    const needEnrich = candidates.filter((p) => !p.tags || p.tags.length < 3);
    const batch = needEnrich.slice(0, limit);

    if (batch.length === 0) {
      return NextResponse.json({
        enriched: 0,
        remaining: 0,
        total: candidates.length,
        message: "Все товары уже обогащены",
      });
    }

    const targetLang = business.language || "ru";
    let enrichedCount = 0;

    for (const p of batch) {
      try {
        const out = await enrichProduct(
          {
            name: p.name,
            description: p.description,
            category: p.category,
            existingTags: p.tags,
          },
          targetLang
        );
        // Признак реального обогащения: в out.tags есть хотя бы 3 элемента.
        // Если ANTHROPIC_API_KEY не задан или Claude упал — enrichProduct тихо
        // вернёт исходные tags, и обновлять запись с теми же данными бессмысленно
        // (это создавало бы бесконечный цикл — фронт думал бы что прогресс есть).
        const reallyEnriched = (out.tags?.length || 0) >= 3;
        if (!reallyEnriched) continue;

        await prisma.product.update({
          where: { id: p.id },
          data: {
            description: out.description,
            category: out.category,
            tags: out.tags,
          },
        });
        enrichedCount++;
      } catch (err) {
        console.error(`[enrich-batch] product ${p.id} failed:`, err);
        // продолжаем — не валим всю пачку из-за одного товара
      }
    }

    if (enrichedCount > 0) {
      await markBusinessConversationsForRefresh(business.id);
    }

    // Если в этом батче не обогатили НИ одного товара (хотя кандидаты были) —
    // это сигнал что Claude/ключ сломан. Возвращаем 502, фронт покажет причину
    // и не будет крутиться в бесконечном цикле.
    if (batch.length > 0 && enrichedCount === 0) {
      return NextResponse.json(
        {
          error:
            "AI не вернул обогащённые данные ни для одного товара. " +
            "Проверьте ANTHROPIC_API_KEY в Vercel Environment Variables, " +
            "или подождите — возможно сработал rate limit.",
        },
        { status: 502 }
      );
    }

    const remaining = needEnrich.length - batch.length;
    return NextResponse.json({
      enriched: enrichedCount,
      remaining,
      total: candidates.length,
    });
  } catch (error) {
    console.error("POST /api/products/enrich-batch:", error);
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json({ error: `Ошибка обогащения: ${message}` }, { status: 500 });
  }
}
