import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

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

/**
 * Проверяет rate limit для ключа (IP-based).
 * @param key       уникальный ключ, напр. "login:1.2.3.4"
 * @param max       максимум попыток
 * @param windowMin размер окна в минутах
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMin: number
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
  } catch {
    // Если БД недоступна — разрешаем запрос (fail open)
    return { allowed: true, remaining: 1, retryAfterSeconds: 0 };
  }
}
