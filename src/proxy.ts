import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Optimistic check only: sends visitors without a session cookie to sign in.
// Role checks happen in requireRole() on every admin page and action.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/iniciar-sesion", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
