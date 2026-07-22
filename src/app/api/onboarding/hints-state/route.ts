/**
 * GET /api/onboarding/hints-state
 *
 * Возвращает статус всех contextual баннеров для текущего бизнеса:
 *   { states: { [pageId]: { done, dismissed } }, requiredTotal, requiredDone, nextRequiredId }
 *
 * Используется:
 *   - Компонентом <PageHint> — решает, показывать ли конкретный баннер
 *   - Глобальным шагомером в dashboard layout — показывает "5 из 8 шагов"
 */

import { NextResponse } from "next/server";
import { getCurrentBusinessId } from "@/lib/auth-helpers";
import { getHintsState, HINTS } from "@/lib/onboarding-hints";

export const dynamic = "force-dynamic";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    // Возвращаем пустой state, а не 401 — компонент <PageHint> просто
    // не отрендерится. Не хочу спамить консоль клиента ошибками
    // авторизации если сессия истекла на фоне.
    return NextResponse.json({
      states: {},
      requiredTotal: 0,
      requiredDone: 0,
      nextRequiredId: null,
    });
  }

  try {
    const state = await getHintsState(businessId);
    // Отдаём заголовки чтобы фронт мог кэшировать на 30 секунд —
    // hints-state вызывается на каждой странице дашборда.
    return NextResponse.json(state, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    console.error("[hints-state] failed:", e);
    // При ошибке БД — возвращаем «всё done, ничего не показывать» чтобы
    // не сломать дашборд. Владелец не увидит баннеры этот сеанс, следующий
    // page-refresh попробует снова.
    const empty: Record<string, { done: boolean; dismissed: boolean }> = {};
    for (const id of Object.keys(HINTS)) empty[id] = { done: true, dismissed: true };
    return NextResponse.json({
      states: empty,
      requiredTotal: 0,
      requiredDone: 0,
      nextRequiredId: null,
    });
  }
}
