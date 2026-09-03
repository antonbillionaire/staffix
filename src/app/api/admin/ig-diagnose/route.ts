/**
 * GET /api/admin/ig-diagnose?businessId=<id>
 *
 * Диагностический endpoint для проблемы «бот не отвечает в Instagram DM»,
 * созданный 3 сентября 2026 после того как у OLLEE после переподключения FB
 * IG сначала работал (4 сообщения в 17:30 UTC 2 сентября), потом замолчал.
 *
 * Только чтение (Graph API GET), никаких мутаций в БД или Meta. Admin-only.
 * Ни один токен не возвращается клиенту — только маскированные хвосты для
 * идентификации ("...abc123") и статусы вызовов.
 *
 * Отвечает на вопросы:
 *   1. Валиден ли user access token (metaUserAccessToken) прямо сейчас?
 *   2. Валиден ли Page access token (fbPageAccessToken)?
 *   3. Какие permissions/scopes реально выданы юзеру для нашего приложения?
 *   4. Подписан ли FB Page на webhook fields нашего приложения?
 *   5. Подписан ли Instagram Business Account на webhook fields нашего приложения?
 *   6. Видит ли Meta нашу FB Page → IG account связь корректно?
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

function mask(token: string | null | undefined): string {
  if (!token) return "(null)";
  if (token.length < 8) return "(short)";
  return `...${token.slice(-6)} (len=${token.length})`;
}

async function callGraph(url: string): Promise<{
  status: number;
  ok: boolean;
  body: unknown;
}> {
  try {
    const res = await fetch(url, { method: "GET" });
    const status = res.status;
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => "");
    }
    return { status, ok: res.ok, body };
  } catch (e) {
    return {
      status: 0,
      ok: false,
      body: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = request.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json(
      { error: "Provide ?businessId=<id>" },
      { status: 400 }
    );
  }

  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      botActive: true,
      igActive: true,
      igUsername: true,
      igBusinessAccountId: true,
      fbActive: true,
      fbPageId: true,
      fbPageAccessToken: true,
      metaUserAccessToken: true,
      metaTokenExpiresAt: true,
    },
  });

  if (!biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Расшифровываем токены. Passthrough для plaintext (backwards-compat).
  const userToken = biz.metaUserAccessToken
    ? decrypt(biz.metaUserAccessToken) || biz.metaUserAccessToken
    : null;
  const pageToken = biz.fbPageAccessToken
    ? decrypt(biz.fbPageAccessToken) || biz.fbPageAccessToken
    : null;

  const results: Record<string, unknown> = {
    business: {
      id: biz.id,
      name: biz.name,
      botActive: biz.botActive,
      igActive: biz.igActive,
      igUsername: biz.igUsername,
      igBusinessAccountId: biz.igBusinessAccountId,
      fbActive: biz.fbActive,
      fbPageId: biz.fbPageId,
      metaTokenExpiresAt: biz.metaTokenExpiresAt,
      metaTokenExpired: biz.metaTokenExpiresAt
        ? biz.metaTokenExpiresAt.getTime() < Date.now()
        : null,
    },
    tokens: {
      userToken: mask(userToken),
      pageToken: mask(pageToken),
    },
    checks: {} as Record<string, unknown>,
  };

  const checks = results.checks as Record<string, unknown>;

  // 1. User token — /me
  if (userToken) {
    checks.userTokenMe = await callGraph(
      `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`
    );
    // 2. User granted permissions — что реально выдано
    checks.userPermissions = await callGraph(
      `${GRAPH}/me/permissions?access_token=${encodeURIComponent(userToken)}`
    );
    // 3. User accounts — все Pages которые видит user token
    checks.userAccounts = await callGraph(
      `${GRAPH}/me/accounts?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(userToken)}`
    );
  } else {
    checks.userTokenMe = "SKIP: no userToken in DB";
  }

  // 4. Page token — /{pageId}
  if (pageToken && biz.fbPageId) {
    checks.pageTokenInfo = await callGraph(
      `${GRAPH}/${biz.fbPageId}?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(pageToken)}`
    );
    // 5. FB Page subscribed_apps — какие приложения подписаны на webhooks этой страницы
    checks.fbPageSubscribedApps = await callGraph(
      `${GRAPH}/${biz.fbPageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`
    );
  } else {
    checks.pageTokenInfo = "SKIP: no pageToken or fbPageId";
  }

  // 6. Instagram Business Account subscribed_apps — ГЛАВНАЯ ПРОВЕРКА
  // Именно здесь Meta показывает подписан ли IG account на webhook events
  // нашего приложения. Без этой подписки IG DM в webhook не приходят.
  if (pageToken && biz.igBusinessAccountId) {
    checks.igSubscribedApps = await callGraph(
      `${GRAPH}/${biz.igBusinessAccountId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`
    );
    // 7. IG account info — жив ли, привязан ли к нашей странице
    checks.igAccountInfo = await callGraph(
      `${GRAPH}/${biz.igBusinessAccountId}?fields=id,username,name&access_token=${encodeURIComponent(pageToken)}`
    );
  } else {
    checks.igSubscribedApps = "SKIP: no pageToken or igBusinessAccountId";
  }

  return NextResponse.json(results, {
    // Не кэшировать — данные диагностики
    headers: { "Cache-Control": "no-store" },
  });
}
