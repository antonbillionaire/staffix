/**
 * POST /api/import/product-photos/token (12 августа 2026)
 *
 * Выдаёт short-lived token для прямой загрузки одного файла из браузера
 * в Vercel Blob через @vercel/blob/client. Обходит 4.5 MB body-лимит
 * serverless-функций Vercel — файл уходит в Blob напрямую, минуя нас.
 *
 * Клиент вызывает `upload(pathname, file, { handleUploadUrl: '/api/import/product-photos/token' })`
 * из @vercel/blob/client. Vercel Blob дважды дёргает этот эндпоинт:
 *   1. blob.generate-client-token — просит выдать token под pathname
 *   2. blob.upload-completed — сообщает что файл залит (мы игнорируем,
 *      матчинг делается в /commit после всей пачки)
 *
 * После всех upload'ов клиент шлёт массив {url, filename} на
 * /api/import/product-photos/commit — там уже auth-проверка и матчинг
 * по имени файла к Product.sku.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const businessId = await getUserBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Token-эндпоинт дёргается по разу на файл. Farrukh (OLLEE) грузил ~40 фото
  // за раз, headroom на 500 файлов/час — совпадает с MAX_UPLOADS в /commit.
  const rl = await rateLimit(`import-photos-token:${businessId}`, 600, 60, "open");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Слишком много загрузок за час. Подождите и попробуйте снова." },
      { status: 429 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Требуем префикс `products/{businessId}/` — бизнес A не сможет
        // выпросить token на pathname бизнеса B (даже если бы предположил
        // чужой businessId, здесь auth-контекст свой).
        const expectedPrefix = `products/${businessId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Некорректный путь загрузки");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({ businessId }),
        };
      },
      onUploadCompleted: async () => {
        // Не делаем ничего — матчинг и update Product.imageUrl в /commit.
        // Vercel Blob дёргает этот callback только в проде (в dev через
        // ngrok — иначе callback не дойдёт до localhost). В любом случае
        // мы на него не завязаны.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    console.error("[import-photos/token] handleUpload failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось создать токен загрузки" },
      { status: 400 }
    );
  }
}
