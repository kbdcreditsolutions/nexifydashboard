import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  // Exclude NextAuth's own routes, the login page, Next's build/image
  // assets, and anything that looks like a static file (favicon/app icon,
  // or public/ assets such as /brand/*.png) — otherwise an unauthenticated
  // request for a plain image gets redirected to /login instead of served.
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
