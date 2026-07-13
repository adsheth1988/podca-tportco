import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import PostgresAdapter from "@auth/pg-adapter";
import { getPool } from "@/lib/db/client";
import { isApproved } from "@/lib/db/approvals";

// The owner always has access; everyone else needs an approved_emails row
// (see src/lib/db/approvals.ts and the /admin approval page). Exported so
// the admin route can restrict itself to the owner too.
export const OWNER_EMAILS = (process.env.OWNER_EMAILS ?? "")
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
      const email = user.email.toLowerCase();
      if (OWNER_EMAILS.includes(email)) return true;
      return isApproved(email);
    },
    // Drives proxy.ts's gating: `auth` is re-exported there as the default
    // export (not called at module scope — see proxy.ts for why), so this
    // is what decides whether a gated request gets redirected to sign-in.
    authorized({ auth }) {
      return !!auth;
    },
  },
}));
