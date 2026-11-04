import { NextRequest, NextResponse } from "next/server";
import {
  MAINTENANCE_MODE,
  MAINTENANCE_HTML,
  WEBHOOK_PREFIXES,
  ALWAYS_ALLOWED_PREFIXES,
} from "@/lib/maintenance";

// Routes that must remain public (no auth check)
const PUBLIC_API_PREFIXES = [
  "/api/telegram/webhook",
  "/api/instagram/webhook",
  "/api/facebook/webhook",
  "/api/whatsapp/webhook",
  "/api/sales-bot/",
  "/api/webhooks/",
  "/api/auth/",
  "/api/cron/",
  "/api/health",
  "/api/consultation/",
  "/api/dev/",
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ─── ЗАГЛУШКА «ПРОЕКТ В РАЗРАБОТКЕ» (4 ноября 2026) ───
  // Стоит ПЕРВОЙ и без исключений: ни страницы, ни API, ни вход, ни дашборд.
  // Как вернуть сайт — в lib/maintenance.ts.
  if (MAINTENANCE_MODE) {
    // Удаление персональных данных по запросу Meta работает всегда: это
    // обязательство по их Platform Terms, а не функция продукта, и закрытый
    // проект от него не освобождает. Пропускаем к роуту, он исполняется.
    const alwaysAllowed = ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

    // Вебхукам отвечаем пустым 200 — иначе Meta отключит подписку страницы, а
    // Telegram снимет вебхук бота за повторяющиеся ошибки, и после возврата
    // проекта каналы пришлось бы переподключать у каждого клиента вручную.
    // Это не работа Staffix: запрос до роута не доходит, не выполняется ничего.
    if (!alwaysAllowed) {
      if (WEBHOOK_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return new NextResponse(null, { status: 200 });
      }
      return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "86400",
        },
      });
    }
  }

  // ─── AUTH: Protect dashboard pages and API routes ───
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("authjs.session-token")?.value; // dev fallback

  if (pathname.startsWith("/dashboard") && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    pathname.startsWith("/api/") &&
    !isPublicApiRoute(pathname) &&
    !sessionCookie &&
    request.method !== "GET" // allow GET for public data fetches
  ) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── CSRF: Origin check for API mutations (not webhooks/cron/auth) ───
  if (
    pathname.startsWith("/api/") &&
    !pathname.includes("/webhook") &&
    !pathname.startsWith("/api/sales-bot/") &&
    !pathname.startsWith("/api/webhooks/") &&
    !pathname.startsWith("/api/cron/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/instagram/comments") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    const allowed = ["https://www.staffix.io", "https://staffix.io"];
    if (process.env.NODE_ENV === "development") allowed.push("http://localhost:3000");
    if (!origin || !allowed.includes(origin)) {
      return new Response("Forbidden: invalid or missing origin", { status: 403 });
    }
  }

  // PayPro redirects via POST after payment — convert to GET
  if (request.method === "POST" && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    return NextResponse.redirect(url, 303); // 303 = See Other (forces GET)
  }

  const response = NextResponse.next();

  // Referral tracking: set cookie when ?ref=CODE is in URL
  const refCode = request.nextUrl.searchParams.get("ref");
  if (refCode && /^[a-zA-Z0-9_-]{3,32}$/.test(refCode)) {
    // 60-day cookie for referral attribution (декларировано в условиях программы
    // и в кабинете партнёра — должно совпадать).
    response.cookies.set("staffix_ref", refCode, {
      maxAge: 60 * 24 * 60 * 60, // 60 days
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Page routes (existing)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
