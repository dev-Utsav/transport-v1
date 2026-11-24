import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/session";

/**
 * First lock: every page needs a validly signed, unexpired session cookie, except the login page
 * and the nightly backup cron (which checks its own secret). Cheap, no database: whether the user
 * is still active and what they may open is checked on the page / action (server/auth.ts).
 */
export async function proxy(request: NextRequest) {
  const secret = sessionSecret(process.env.SESSION_SECRET, process.env.NODE_ENV);
  if (!secret) return new NextResponse("SESSION_SECRET is not set.", { status: 503 });
  const claims = await verifySession(secret, request.cookies.get(SESSION_COOKIE)?.value);
  if (claims) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!login|api/cron|_next/static|_next/image|favicon.ico|icon|manifest.webmanifest).*)",
  ],
};
