import "server-only";
import { Pool } from "@neondatabase/serverless";

// Neon's Pool is API-compatible with node-postgres's Pool but works over
// HTTP/WebSockets, which is required for Vercel's serverless functions
// (no persistent TCP connections available there).
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in environment variables");
  return url;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: requireDatabaseUrl() });
  return pool;
}
