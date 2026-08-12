/**
 * POST /api/import/product-photos/commit (12 августа 2026)
 *
 * Вторая половина client-upload flow: клиент уже залил файлы напрямую в
 * Vercel Blob (см. ../token/route.ts), теперь шлёт сюда массив
 * `{ url, filename }[]` — матчим каждый по basename (без расширения) к
 * Product.sku и обновляем imageUrl.
 *
 * Тело маленькое (JSON с URL'ами, не с бинарями) → в 4.5 MB body-лимит
 * Vercel'а вписываемся с большим запасом даже на 500 файлов.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { markBusinessConversationsForRefresh } from "@/lib/knowledge-refresh";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOADS = 500;
const MAX_FILENAME_LENGTH = 255;

// Vercel Blob public URLs: https://<store-hash>.public.blob.vercel-storage.com/<path>
// Валидация — чтобы клиент не подсунул произвольный URL (SSRF нет, т.к. мы URL
// только сохраняем в Product.imageUrl, но всё равно закрываем поверхность атаки).
const BLOB_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;

interface UploadRef {
  url: string;
  filename: string;
}

interface CommitRequest {
  uploads: UploadRef[];
}

async function getUserBusinessId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return null;
  const business = await prisma.business.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  return business?.id || null;
}

function stripExt(filename: string): string {
  const parts = filename.split(/[\\/]/);
  const base = parts[parts.length - 1] || filename;
  const dotIdx = base.lastIndexOf(".");
  return (dotIdx > 0 ? base.slice(0, dotIdx) : base).trim();
}

export async function POST(request: NextRequest) {
  const businessId = await getUserBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`import-photos-commit:${businessId}`, 10, 60, "open");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите час и попробуйте снова." },
      { status: 429 }
    );
  }

  let body: CommitRequest;
  try {
    body = (await request.json()) as CommitRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.uploads) || body.uploads.length === 0) {
    return NextResponse.json(
      { error: "Не передан список загруженных файлов" },
      { status: 400 }
    );
  }
  if (body.uploads.length > MAX_UPLOADS) {
    return NextResponse.json(
      { error: `Слишком много файлов (максимум ${MAX_UPLOADS})` },
      { status: 400 }
    );
  }

  // Валидация каждого элемента: URL из нашего Blob'а, имя разумной длины.
  for (const u of body.uploads) {
    if (typeof u?.url !== "string" || typeof u?.filename !== "string") {
      return NextResponse.json({ error: "Некорректный формат uploads" }, { status: 400 });
    }
    if (!BLOB_URL_PATTERN.test(u.url)) {
      return NextResponse.json({ error: "Некорректная ссылка на загруженный файл" }, { status: 400 });
    }
    if (u.filename.length === 0 || u.filename.length > MAX_FILENAME_LENGTH) {
      return NextResponse.json({ error: "Некорректное имя файла" }, { status: 400 });
    }
  }

  // Товары этого бизнеса с непустым SKU. sku при импорте CSV мапится с
  // алиасов «штрихкод»/«ean»/«barcode» (см. import/products ALIASES) —
  // поэтому имя файла `8809722156116.jpg` матчится к товару со штрихкодом.
  const products = await prisma.product.findMany({
    where: { businessId, sku: { not: null }, isActive: true },
    select: { id: true, sku: true, name: true },
  });
  const skuToProduct = new Map<string, { id: string; name: string }>();
  for (const p of products) {
    if (p.sku) skuToProduct.set(p.sku.trim(), { id: p.id, name: p.name });
  }

  interface MatchResult {
    file: string;
    status: "matched" | "unmatched" | "update_failed";
    productId?: string;
    productName?: string;
    imageUrl?: string;
  }

  const results: MatchResult[] = body.uploads.map((u) => {
    const sku = stripExt(u.filename);
    const product = skuToProduct.get(sku);
    if (!product) {
      return { file: u.filename, status: "unmatched" };
    }
    return {
      file: u.filename,
      status: "matched",
      productId: product.id,
      productName: product.name,
      imageUrl: u.url,
    };
  });

  // Батчами обновляем Product.imageUrl — не забиваем connection pool Prisma.
  const UPDATE_CONCURRENCY = 5;
  const toUpdate = results.filter((r) => r.status === "matched");
  for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
    const chunk = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map((r) =>
        prisma.product.update({
          where: { id: r.productId! },
          data: { imageUrl: r.imageUrl! },
        })
      )
    );
    settled.forEach((s, idx) => {
      if (s.status === "rejected") {
        console.error(
          `[import-photos/commit] update failed for ${chunk[idx].file}:`,
          s.reason
        );
        chunk[idx].status = "update_failed";
      }
    });
  }

  const matched = results.filter((r) => r.status === "matched");
  const unmatched = results.filter((r) => r.status === "unmatched");
  const failed = results.filter((r) => r.status === "update_failed");

  if (matched.length > 0) {
    await markBusinessConversationsForRefresh(businessId).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    totalFiles: body.uploads.length,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    invalidCount: 0,
    failedCount: failed.length,
    unmatchedSample: unmatched.slice(0, 10).map((r) => r.file),
    message: `Загружено фото: ${matched.length}${
      unmatched.length > 0 ? ` · Не сматчено: ${unmatched.length}` : ""
    }${failed.length > 0 ? ` · Ошибок: ${failed.length}` : ""}`,
  });
}
