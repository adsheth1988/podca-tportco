// NOTE: this file replaces the deprecated `middleware.ts` convention in this
// Next.js version — see node_modules/next/dist/docs/.../file-conventions/proxy.md.
// Gates the new personal-portfolio routes behind an authenticated session;
// everything else (including the existing QQQ podcast) is untouched.
//
// IMPORTANT: re-export `auth` directly — do NOT call it here (e.g.
// `auth((req) => {...})`). src/auth.ts's NextAuth config is a lazy factory
// function (to defer its DATABASE_URL check past `next build`'s page-data
// collection), which makes `auth` resolve to an async wrapper. Calling it
// eagerly at module scope returns a Promise, not a function, and Next.js's
// proxy loader requires the default export to synchronously be a function.
// Re-exporting the reference sidesteps that — Next.js invokes it itself at
// request time, and src/auth.ts's `authorized` callback drives the
// redirect-to-sign-in behavior below.
import { auth } from "@/auth";

export default auth;

export const config = {
  matcher: [
    "/settings/:path*",
    "/api/snaptrade/:path*",
    "/api/generate-live-episode",
    "/api/personal-episodes/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
