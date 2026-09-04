/**
 * POST /api/admin/reenrich-catalog?businessId=<id>&limit=<n>
 *
 * Принудительное повторное обогащение каталога конкретного бизнеса —
 * прогоняет активные товары через enrichProduct **независимо от того,
 * есть ли у них уже теги**. Нужно после расширения промпта в
 * catalog-enricher (4 сентября 2026): у OLLEE tags уже >=3, поэтому
 * обычный /api/products/enrich-batch их пропускает, а свежие stage-теги
 * (очищение / тонизация / SPF / макияж и т.п.) — не добавляются.
 *
 * Admin-only (isAdmin по e-mail). Одноразовый триггер после prompt-апдейта.
 *
 * Trick для форс-обогащения: передаём `existingTags: []` в enrichProduct.
 * Это обманывает его early-return (skip if description на нужном языке И
 * тегов >=3) и заставляет реально дёрнуть Haiku. Существующие теги мы
 * потом мержим в результат сами — не теряем то что уже было.
 *
 * Работает партиями по ~10 товаров чтобы уложиться в Vercel timeout 60с
 * (при ~2-3с/товар). Каждый вызов обрабатывает до `limit` товаров,
 * возвращает { enriched, remaining, total } — админ может дёрнуть
 * несколько раз пока remaining > 0.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { enrichProduct } from "@/lib/catalog-enricher";
import { markBusinessConversationsForRefresh } from "@/lib/knowledge-refresh";

// Vercel Pro поддерживает до 300 сек — берём максимум. Первый прогон
// admin'ом на OLLEE с limit=25 упёрся в 60-сек таймаут (25 × ~3 сек = 75).
// С 300 сек уложимся при любом разумном batch size.
export const maxDuration = 300;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 40;
// Пауза между вызовами Haiku — защита от Anthropic rate limit при большом batch.
// 300 мс × 40 товаров = 12 сек накладных, приемлемо.
const HAIKU_DELAY_MS = 300;

/**
 * Канонический набор stage-slug'ов (в lowercase) — если ни один из них
 * не встречается ни в одном теге товара, товар считается «без stage-разметки»
 * и подлежит принудительному re-enrichment. Хардкод, потому что prompt в
 * enricher формирует именно из этого списка.
 */
const STAGE_SLUGS = [
  "очищение",
  "умывание",
  "тонизация",
  "тонер",
  "эссенция",
  "сыворотка",
  "серум",
  "увлажнение",
  "уход",
  "крем для лица",
  "защита от солнца",
  "spf",
  "санскрин",
  "снятие макияжа",
  "демакияж",
  "маска для лица",
  "эксфолиация",
  "пилинг",
  "скраб",
  "патч",
  "макияж",
  "мейкап",
  "тональная основа",
  "bb-крем",
  "тушь для ресниц",
  "губная помада",
  "тени для век",
  "румяна",
  "уход за волосами",
  "шампунь",
  "кондиционер",
];

function hasStageTag(tags: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  const lowered = new Set(tags.map((t) => t.trim().toLowerCase()));
  return STAGE_SLUGS.some((s) => lowered.has(s));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Provide ?businessId=<id>" }, { status: 400 });
  }
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10), 1),
    MAX_LIMIT
  );

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, language: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Все активные товары бизнеса. Отфильтруем те у кого уже есть stage-теги
  // (значит уже обогащены новым промптом) — не тратим Haiku впустую.
  const allProducts = await prisma.product.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true, description: true, category: true, tags: true },
    orderBy: { updatedAt: "asc" },
  });
  const needStageEnrich = allProducts.filter((p) => !hasStageTag(p.tags));
  const batch = needStageEnrich.slice(0, limit);

  if (batch.length === 0) {
    return NextResponse.json({
      businessId,
      businessName: business.name,
      enriched: 0,
      remaining: 0,
      total: allProducts.length,
      message: "Все активные товары уже имеют stage-теги",
    });
  }

  const targetLang = business.language || "ru";
  let enrichedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < batch.length; i++) {
    const p = batch[i];
    // Пауза перед КАЖДЫМ вызовом кроме первого — размазываем нагрузку на Haiku,
    // чтобы не влететь в 429 при большом batch.
    if (i > 0) await new Promise((r) => setTimeout(r, HAIKU_DELAY_MS));
    try {
      // ТРЮК: передаём existingTags:[] чтобы enrichProduct не сработал early-return
      // (skip if description на нужном языке И tags>=3). Реально дёрнет Haiku и
      // вернёт новые теги с stage-разметкой из обновлённого промпта.
      const out = await enrichProduct(
        {
          name: p.name,
          description: p.description,
          category: p.category,
          existingTags: [],
        },
        targetLang
      );

      // Мержим свежие теги от Haiku с существующими (case-insensitive dedup).
      // Не теряем то что уже было — просто добавляем stage-теги + новые синонимы.
      const seen = new Set<string>();
      const merged: string[] = [];
      for (const t of [...(out.tags || []), ...p.tags]) {
        const key = t.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(t.trim());
      }

      const finalTags = merged.slice(0, 20);
      const reallyEnriched =
        (out.tags?.length || 0) >= 3 || hasStageTag(finalTags);
      if (!reallyEnriched) {
        errors.push(`${p.id}: enricher returned <3 tags, skipping`);
        continue;
      }

      await prisma.product.update({
        where: { id: p.id },
        data: {
          description: out.description,
          category: out.category,
          tags: finalTags,
        },
      });
      enrichedCount++;
    } catch (err) {
      console.error(`[reenrich-catalog] product ${p.id} failed:`, err);
      errors.push(
        `${p.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (enrichedCount > 0) {
    await markBusinessConversationsForRefresh(business.id).catch(() => {});
  }

  return NextResponse.json({
    businessId,
    businessName: business.name,
    enriched: enrichedCount,
    remaining: needStageEnrich.length - batch.length,
    total: allProducts.length,
    errors: errors.slice(0, 10),
  });
}

export const GET = POST;
