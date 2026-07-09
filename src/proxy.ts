// NOTE: this file replaces the deprecated `middleware.ts` convention in this
// Next.js version — see node_modules/next/dist/docs/.../file-conventions/proxy.md.
// Gates the new personal-portfolio routes behind an authenticated session;
// everything else (including the existing QQQ podcast) is untouched.
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/settings/:path*", "/api/snaptrade/:path*", "/api/generate-live-episode"],
};
