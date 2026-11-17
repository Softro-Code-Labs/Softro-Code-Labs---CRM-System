import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Optimistic check only: redirects visitors without a valid session cookie.
// Real authorization happens in the Data Access Layer (src/lib/auth.ts).
const PUBLIC_PATHS = ["/login"];
const SESSION_COOKIE = "softro_session";

async function hasValidSession(token: string | undefined) {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const loggedIn = await hasValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !loggedIn) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (isPublic && loggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
