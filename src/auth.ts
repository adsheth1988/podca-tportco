import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import PostgresAdapter from "@auth/pg-adapter";
import { getPool } from "@/lib/db/client";

// MVP: sign-in is restricted to the owner via an email allowlist below.
// The underlying model is already a real multi-user `users` table, so
// removing this allowlist later (multi-user phase) needs no re-architecture.
const OWNER_EMAILS = (process.env.OWNER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Lazy config initialization: defers getPool() (and its DATABASE_URL check)
// until the first real request, instead of running at module-evaluation
// time — required so `next build`'s page-data collection doesn't fail
// before DATABASE_URL is configured (it only executes route handler
// modules, not requests).
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: PostgresAdapter(getPool()),
  providers: [GitHub],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return OWNER_EMAILS.includes(user.email.toLowerCase());
    },
  },
}));
