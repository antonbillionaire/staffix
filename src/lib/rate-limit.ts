import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

/**
 * Извлекает клиентский IP из HTTP-заголовков.
 *
 * ⚠️  Работает БЕЗОПАСНО только на Vercel: Vercel ingress перезаписывает
 * `x-forwarded-for` / `x-real-ip` реальным IP клиента, игнорируя любые
 * клиентские значения. На других платформах (AWS Amplify, Cloudflare
 * Workers, self-hosted Node) эти заголовки могут содержать подделанные
 * данные — rate limit сломается (attacker подставит фейковый IP для
 * обхода лимитов).
 *
 * При смене хостинга обязательно проверить платформенный контракт по
 * `x-forwarded-for` и при необходимости использовать trusted proxy
 * headers конкретной платформы или встроенный ingress-parsing.
 */
export function getClientIp(request: NextRequest | Request): string {
  const forwarded =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

type FailMode = "open" | "closed";

/**
 * Проверяет rate limit для ключа (IP-based).
 * @param key       уникальный ключ, напр. "login:1.2.3.4"
 * @param max       максимум попыток
 * @param windowMin размер окна в минутах
 * @param failMode  поведение при недоступности БД:
 *   - "open" (по умолчанию, обратная совместимость): разрешить запрос —
 *     для не-критичных мест (webhooks клиентов, chat widget), где потеря
 *     rate limit во время лага БД лучше чем блокировка легитимных запросов.
 *   - "closed": отказать запросу — обязателен для auth-эндпоинтов
 *     (forgot/reset), где fail-open даёт злоумышленнику окно безлимитного
 *     подбора кодов/паролей во время инцидента БД.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMin: number,
  failMode: FailMode = "open"
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMin * 60 * 1000);

  try {
    // Удаляем истёкшие записи для этого ключа
    const existing = await prisma.rateLimitEntry.findUnique({ where: { key } });

    if (!existing || existing.resetAt < now) {
      // Новое окно — сбрасываем счётчик
      await prisma.rateLimitEntry.upsert({
        where: { key },
        create: { key, attempts: 1, resetAt },
        update: { attempts: 1, resetAt },
      });
      return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
    }

    if (existing.attempts >= max) {
      const retryAfterSeconds = Math.ceil(
        (existing.resetAt.getTime() - now.getTime()) / 1000
      );
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    await prisma.rateLimitEntry.update({
      where: { key },
      data: { attempts: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: max - existing.attempts - 1,
      retryAfterSeconds: 0,
    };
  } catch (err) {
    if (failMode === "closed") {
      console.error(
        `[rate-limit] DB failure, failing CLOSED for key=${key}:`,
        err instanceof Error ? err.message : String(err)
      );
      // Отдаём 60 сек retry — чтобы не спамить попытки в момент лага
      return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    }
    // Fail-open: не-критичные эндпоинты
    return { allowed: true, remaining: 1, retryAfterSeconds: 0 };
  }
}
