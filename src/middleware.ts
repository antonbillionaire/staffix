import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // PayPro redirects via POST after payment — convert to GET
  if (request.method === "POST" && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    return NextResponse.redirect(url, 303); // 303 = See Other (forces GET)
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
