import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import {
  GUEST_COOKIE,
  createGuestCookieValue,
  verifyGuestCookieValue,
} from "./lib/guest-cookie";

/**
 * Next.js 16 renamed Middleware to Proxy; `middleware.ts` still works but is deprecated, and
 * `proxy` runs on the Node runtime (not configurable). Clerk 7.9.x recognises both filenames.
 *
 * Two jobs here:
 *  - `clerkMiddleware` populates the auth state that `auth()` reads in routes and components.
 *    It deliberately does not block anyone, because guests must reach the whole app.
 *  - Mint the guest id. This has to happen at the proxy layer: a Server Component render cannot
 *    set a cookie in Next.js, so there is nowhere else early enough to issue one.
 */
export default clerkMiddleware((_auth, request: NextRequest) => {
  const response = NextResponse.next();
  const existing = request.cookies.get(GUEST_COOKIE)?.value;

  // Also re-issues when the cookie is present but fails its signature check, so a forged or
  // corrupted value heals on the next request instead of leaving the visitor permanently
  // unidentified.
  if (!verifyGuestCookieValue(existing)) {
    response.cookies.set(GUEST_COOKIE, createGuestCookieValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
});

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
