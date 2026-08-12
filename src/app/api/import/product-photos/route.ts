/**
 * POST /api/import/product-photos (30 июля 2026)
 *
 * ⚠️ DEPRECATED (12 августа 2026): фронт больше не вызывает этот endpoint.
 * Он ломался на любом ZIP > 4.5 MB — это hard-лимит body serverless-функций
 * Vercel'а, наш `MAX_TOTAL_SIZE = 100 MB` никогда не срабатывал (Vercel
 * отбивал 413 раньше). Клиенты OLLEE (Farrukh) наступили на это 11 августа
 * и увидели «Unexpected token 'R', "Request En..." is not valid JSON» —
 * фронт JSON.parse'ил plain-text 413 от Vercel'а.
 *
 * Новый flow: см. ./token/route.ts + ./commit/route.ts — прямой upload из
 * браузера в Vercel Blob (@vercel/blob/client.upload), потом JSON-commit
 * на бэк для матчинга. Тело commit'а — только URL'ы, в 4.5 MB вписывается
 * с гигантским запасом.
 *
 * Endpoint пока не удаляю — вдруг новый flow где-то встанет, откатимся
 * заменой fetch-URL на фронте. Удалим ~19 августа, если жалоб не будет.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Оригинальное описание (для истории):
 *
 * Массовая загрузка фото товаров. Принимает ZIP-архив ИЛИ множественные
 * файлы через multipart/form-data. Матчит каждый файл к товару по имени
 * (basename без расширения) — сравнивает с Product.sku (штрихкод/EAN тоже
 * сохраняется в sku, см. import/products ALIASES).
 *
 * Пример: клиент OLLEE присылает 40+ фото файлами `8809722156116.jpg`,
 * `8800304050037.png` и т.д. Endpoint:
 *   1. Читает файлы (или распаковывает ZIP)
 *   2. Для каждого: berName без расширения = `8809722156116`
 *   3. Находит Product с sku=`8809722156116` в этом бизнесе
 *   4. Заливает файл в Vercel Blob → обновляет Product.imageUrl
 *   5. Возвращает отчёт: сматчено N, не сматчено M (с именами файлов)
 *
 * Безопасность:
 *   - checkAuth (сессия владельца бизнеса)
 *   - Rate-limit 10 запросов/час/бизнес (защита от abuse Vercel Blob API)
 *   - MAX_FILES 500 (защита от zip-bomb)
 *   - MAX_FILE_SIZE 5 MB на файл
 *   - MAX_TOTAL_SIZE 100 MB на весь request (Vercel Free tier limit body 4.5 MB,
 *     Pro 100 MB — оставляем запас)
 *   - Content-Type whitelist после распаковки (проверяем content sniffing)
 */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import JSZip from "jszip";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { markBusinessConversationsForRefresh } from "@/lib/knowledge-refresh";

export const maxDuration = 300;

const MAX_FILES = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 5;

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

// Magic bytes для проверки что содержимое действительно image (базовый content sniffing).
// Не полная защита, но защищает от совсем очевидных подделок расширения.
function detectImageContentType(buffer: Uint8Array): string | null {
  if (buffer.length < 8) return null;
  const b = buffer;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  // GIF: 47 49 46 38
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  // WebP: RIFF....WEBP
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp";
  // AVIF/HEIF: часть ISOBMFF, есть ftyp box on offset 4
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    return "image/avif";
  }
  return null;
}

interface PhotoFile {
  name: string;
  data: Uint8Array;
}

/** Извлечь basename без расширения и нормализовать (trim, lowercase не применяем — SKU регистрозависимый). */
function stripExt(filename: string): string {
  // Учитываем что путь в ZIP может быть с подкаталогами: photos/8809.jpg → 8809
  const parts = filename.split(/[\\/]/);
  const base = parts[parts.length - 1] || filename;
  const dotIdx = base.lastIndexOf(".");
  return (dotIdx > 0 ? base.slice(0, dotIdx) : base).trim();
}

function isImageExtension(filename: string): boolean {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx < 0) return false;
  const ext = filename.slice(dotIdx + 1).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/** Батчами по concurrency — не забиваем Vercel Blob API. */
async function inBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(chunk.map(fn));
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value);
    }
  }
  return results;
}

async function getUserBusiness(): Promise<string | null> {
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

export async function POST(request: NextRequest) {
  const businessId = await getUserBusiness();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`import-photos:${businessId}`, 10, 60, "open");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите час и попробуйте снова." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать файлы" }, { status: 400 });
  }

  // Может прийти либо один ZIP файл, либо множественные картинки — обрабатываем оба.
  const files: PhotoFile[] = [];
  let totalSize = 0;

  for (const [, value] of formData.entries()) {
    if (!(value instanceof File)) continue;
    if (files.length >= MAX_FILES) break;

    const isZip =
      value.type === "application/zip" ||
      value.type === "application/x-zip-compressed" ||
      value.name.toLowerCase().endsWith(".zip");

    if (isZip) {
      const zipBuf = await value.arrayBuffer();
      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(zipBuf);
      } catch {
        return NextResponse.json({ error: "Не удалось распаковать ZIP" }, { status: 400 });
      }
      for (const entry of Object.values(zip.files)) {
        if (files.length >= MAX_FILES) break;
        if (entry.dir) continue;
        if (!isImageExtension(entry.name)) continue;
        const data = await entry.async("uint8array");
        if (data.byteLength === 0 || data.byteLength > MAX_FILE_SIZE) continue;
        totalSize += data.byteLength;
        if (totalSize > MAX_TOTAL_SIZE) {
          return NextResponse.json(
            { error: `Общий размер файлов превышает ${Math.round(MAX_TOTAL_SIZE / 1024 / 1024)} MB` },
            { status: 400 }
          );
        }
        files.push({ name: entry.name, data });
      }
    } else {
      // Прямая загрузка изображения (multi-file input)
      if (!isImageExtension(value.name)) continue;
      if (value.size > MAX_FILE_SIZE) continue;
      totalSize += value.size;
      if (totalSize > MAX_TOTAL_SIZE) {
        return NextResponse.json(
          { error: `Общий размер файлов превышает ${Math.round(MAX_TOTAL_SIZE / 1024 / 1024)} MB` },
          { status: 400 }
        );
      }
      const buf = new Uint8Array(await value.arrayBuffer());
      files.push({ name: value.name, data: buf });
    }
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Не найдено файлов изображений. Поддерживаются jpg, png, webp, gif, avif — прямой загрузкой или ZIP-архивом." },
      { status: 400 }
    );
  }

  // Загружаем товары этого бизнеса с непустыми SKU для матчинга.
  // sku может содержать штрихкод — при импорте CSV alias «штрихкод»/«ean»/«barcode»
  // мапится сюда (см. import/products ALIASES).
  const products = await prisma.product.findMany({
    where: { businessId, sku: { not: null }, isActive: true },
    select: { id: true, sku: true, name: true },
  });
  const skuToProduct = new Map<string, { id: string; name: string }>();
  for (const p of products) {
    if (p.sku) skuToProduct.set(p.sku.trim(), { id: p.id, name: p.name });
  }

  // Обрабатываем каждый файл: матчим по basename → загружаем в Blob → update.
  interface MatchResult {
    file: string;
    status: "matched" | "unmatched" | "invalid_content" | "upload_failed";
    productId?: string;
    productName?: string;
    imageUrl?: string;
  }

  const results = await inBatches<PhotoFile, MatchResult>(
    files,
    UPLOAD_CONCURRENCY,
    async (file) => {
      const sku = stripExt(file.name);
      const product = skuToProduct.get(sku);
      if (!product) {
        return { file: file.name, status: "unmatched" };
      }

      const detected = detectImageContentType(file.data);
      if (!detected) {
        // Файл с расширением jpg но неправильным содержимым — отклоняем
        return { file: file.name, status: "invalid_content" };
      }

      try {
        const ext = detected.split("/")[1] || "jpg";
        const filename = `products/${businessId}/bulk-${Date.now()}-${sku}.${ext}`;
        const blob = await put(filename, Buffer.from(file.data), {
          access: "public",
          addRandomSuffix: true,
          contentType: detected,
        });

        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: blob.url },
        });

        return {
          file: file.name,
          status: "matched",
          productId: product.id,
          productName: product.name,
          imageUrl: blob.url,
        };
      } catch (e) {
        console.error(`[import/product-photos] upload failed for ${file.name}:`, e);
        return { file: file.name, status: "upload_failed" };
      }
    }
  );

  const matched = results.filter((r) => r.status === "matched");
  const unmatched = results.filter((r) => r.status === "unmatched");
  const invalid = results.filter((r) => r.status === "invalid_content");
  const failed = results.filter((r) => r.status === "upload_failed");

  // AI получает информацию о товарах через промпт — обновление imageUrl
  // не требует пересчёта AI Memory. Но всё же marker для refresh на всякий:
  if (matched.length > 0) {
    await markBusinessConversationsForRefresh(businessId).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    totalFiles: files.length,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    invalidCount: invalid.length,
    failedCount: failed.length,
    // Топ-10 unmatched для UI отчёта (не весь список чтобы не раздуть response)
    unmatchedSample: unmatched.slice(0, 10).map((r) => r.file),
    message: `Загружено фото: ${matched.length}${
      unmatched.length > 0 ? ` · Не сматчено: ${unmatched.length}` : ""
    }${invalid.length > 0 ? ` · Отклонено (не картинка): ${invalid.length}` : ""}${
      failed.length > 0 ? ` · Ошибок: ${failed.length}` : ""
    }`,
  });
}
