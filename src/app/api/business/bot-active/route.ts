/**
 * POST /api/business/bot-active
 * Body: { botActive: boolean }
 *
 * Переключает флаг `Business.botActive` — глобальная пауза/активация бота
 * во всех каналах (TG / WA / IG / FB / веб-виджет). Все webhook-handlers
 * проверяют этот флаг и молча пропускают входящие сообщения когда он false.
 *
 * Отдельный endpoint (а не расширение общего PUT /api/business) чтобы:
 *  1. UI-кнопка «пауза/активация» работала одним лёгким запросом
 *  2. Не конфликтовать с большим PUT который валидирует много полей
 *  3. Логика тривиальная — не нужен полный сессионный контекст
 *
 * Добавлено 5 сентября 2026 по запросу Anton'а — раньше `botActive` менялся
 * только косвенно (при первом подключении бота = true, при отключении
 * бота через /api/business/telegram = false). Не было явной кнопки «пауза».
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let body: { botActive?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.botActive !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { botActive: boolean }" },
      { status: 400 }
    );
  }

  const business = await prisma.business.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }

  await prisma.business.update({
    where: { id: business.id },
    data: { botActive: body.botActive },
  });

  return NextResponse.json({ success: true, botActive: body.botActive });
}
