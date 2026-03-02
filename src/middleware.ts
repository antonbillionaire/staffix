import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ─── CSRF: Origin check for API mutations (not webhooks/cron/auth) ───
  if (
    pathname.startsWith("/api/") &&
    !pathname.includes("/webhook") &&
    !pathname.startsWith("/api/cron/") &&
    !pathname.startsWith("/api/auth/") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    if (origin) {
      const allowed = ["https://www.staffix.io", "https://staffix.io"];
      if (process.env.NODE_ENV === "development") allowed.push("http://localhost:3000");
      if (!allowed.includes(origin)) {
        return new Response("Forbidden: invalid origin", { status: 403 });
      }
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
    // 60-day cookie for referral attribution
    response.cookies.set("staffix_ref", refCode, {
      maxAge: 60 * 24 * 60 * 60, // 60 days
      httpOnly: false,
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
