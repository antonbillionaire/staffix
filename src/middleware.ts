import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // PayPro redirects via POST after payment — convert to GET
  if (request.method === "POST" && !request.nextUrl.pathname.startsWith("/api/")) {
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
  // Only match page routes, not API or auth routes
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
