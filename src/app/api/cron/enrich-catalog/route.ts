/**
 * Cron Job: Enrich Catalog — добивает необогащённые товары всех бизнесов.
 *
 * Раз в 30 минут проходит по бизнесам с активными товарами без тегов,
 * прогоняет до 30 штук на бизнес через catalog-enricher.
 *
 * Запасной механизм: основной путь обогащения — UI-кнопка владельца.
 * Cron нужен на случай если кто-то импортировал товары и забыл нажать.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichProduct } from "@/lib/catalog-enricher";
import { checkCronAuth } from "@/lib/cron-auth";

export const maxDuration = 60;

const PER_BUSINESS_LIMIT = 30;
const MAX_BUSINESSES_PER_RUN = 5;

export async function POST(request: Request) {
  const cronAuth = checkCronAuth(request);
  if (!cronAuth.ok) return cronAuth.response!;

  try {
    // Ищем бизнесы у которых есть активные товары с пустыми тегами
    const businessesWithUnenriched = await prisma.product.groupBy({
      by: ["businessId"],
      where: {
        isActive: true,
        tags: { isEmpty: true },
      },
      _count: true,
      orderBy: { _count: { businessId: "desc" } },
      take: MAX_BUSINESSES_PER_RUN,
    });

    let totalEnriched = 0;
    const perBusiness: Record<string, number> = {};

    for (const entry of businessesWithUnenriched) {
      const businessId = entry.businessId;
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { language: true },
      });
      const targetLang = business?.language || "ru";

      const products = await prisma.product.findMany({
        where: {
          businessId,
          isActive: true,
          tags: { isEmpty: true },
        },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          tags: true,
        },
        take: PER_BUSINESS_LIMIT,
      });

      let enrichedHere = 0;
      for (const p of products) {
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
          await prisma.product.update({
            where: { id: p.id },
            data: {
              description: out.description,
              category: out.category,
              tags: out.tags,
            },
          });
          enrichedHere++;
          totalEnriched++;
        } catch (err) {
          console.error(`[enrich-cron] product ${p.id} failed:`, err);
        }
      }
      perBusiness[businessId] = enrichedHere;
    }

    console.log(`[enrich-cron] DONE total=${totalEnriched}`, perBusiness);
    return NextResponse.json({ totalEnriched, perBusiness });
  } catch (error) {
    console.error("[enrich-cron] fatal:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const GET = POST;
