import "server-only";
import { getPool } from "./client";

export async function isApproved(email: string): Promise<boolean> {
  const { rows } = await getPool().query(
    `SELECT 1 FROM approved_emails WHERE email = $1`,
    [email.toLowerCase()]
  );
  return rows.length > 0;
}

export async function approveEmail(email: string): Promise<void> {
  await getPool().query(
    `INSERT INTO approved_emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
    [email.toLowerCase()]
  );
}

export async function listApproved(): Promise<string[]> {
  const { rows } = await getPool().query<{ email: string }>(
    `SELECT email FROM approved_emails ORDER BY created_at DESC`
  );
  return rows.map((r) => r.email);
}
