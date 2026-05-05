/**
 * Helper'ы для аутентификации и получения текущего бизнеса в API роутах.
 *
 * Раньше паттерн `auth() → findUnique({ include: { businesses: true } }) → businesses[0]`
 * дублировался в 78+ файлов. Любое изменение схемы User/Business требовало правок
 * в 78 местах. Теперь — одно место.
 *
 * Использование:
 *
 *   // Простой случай — нужен только бизнес
 *   const business = await getCurrentBusiness();
 *   if (!business) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
 *
 *   // Нужен и юзер тоже
 *   const ctx = await getCurrentAuthContext();
 *   if (!ctx) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
 *   const { userId, email, business } = ctx;
 *
 * Helper НЕ возвращает NextResponse намеренно — пусть caller решает какой статус
 * (401 vs 404), какое сообщение и нужно ли логировать.
 */

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Business } from "@prisma/client";

export interface AuthContext {
  userId: string;
  email: string;
  business: Business;
}

/**
 * Возвращает первый бизнес текущего пользователя или null если:
 * - нет сессии
 * - в сессии нет email
 * - юзер не найден в БД
 * - у юзера нет ни одного бизнеса
 */
export async function getCurrentBusiness(): Promise<Business | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businesses: true },
  });

  return user?.businesses[0] || null;
}

/**
 * То же что getCurrentBusiness, но возвращает полный контекст: userId + email + business.
 * Удобно когда роуту нужны все три значения (часто).
 */
export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businesses: true },
  });

  if (!user || !user.businesses[0]) return null;

  return {
    userId: user.id,
    email: user.email,
    business: user.businesses[0],
  };
}

/**
 * Возвращает только businessId — самый частый кейс. Чуть быстрее чем getCurrentBusiness:
 * не грузит все поля бизнеса, только id.
 */
export async function getCurrentBusinessId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { businesses: { select: { id: true }, take: 1 } },
  });

  return user?.businesses[0]?.id || null;
}
