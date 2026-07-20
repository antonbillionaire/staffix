/**
 * Cron endpoint auth check (Sprint MINOR fix).
 *
 * Раньше все /api/cron/* сравнивали authorization header напрямую с
 * `Bearer ${process.env.CRON_SECRET}`. Если CRON_SECRET не выставлен в
 * env — эта строка становится `Bearer undefined`, и любой запрос с
 * заголовком `Authorization: Bearer undefined` проходит проверку.
 *
 * Fail-closed: если CRON_SECRET не выставлен — возвращаем 500. Cron не
 * запустится, зато не откроем endpoint для публики.
 */

import { NextResponse } from "next/server";

export interface CronAuthResult {
  ok: boolean;
  response?: NextResponse;
}

export function checkCronAuth(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 8) {
    console.error("[cron-auth] CRON_SECRET not configured — refusing to run");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 }
      ),
    };
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true };
}
