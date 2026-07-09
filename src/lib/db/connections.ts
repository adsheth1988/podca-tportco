import "server-only";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";
import { getPool } from "./client";

// AES-256-GCM, key derived once from SNAPTRADE_SECRET_ENCRYPTION_KEY.
// Format stored in the DB: "<ivHex>:<authTagHex>:<ciphertextHex>".
const ALGORITHM = "aes-256-gcm";

function requireEncryptionKey(): Buffer {
  const raw = process.env.SNAPTRADE_SECRET_ENCRYPTION_KEY;
  if (!raw) throw new Error("SNAPTRADE_SECRET_ENCRYPTION_KEY is not set in environment variables");
  // Accept any passphrase length — scrypt derives a fixed 32-byte key from it.
  return scryptSync(raw, "snaptrade-user-secret", 32);
}

function encrypt(plaintext: string): string {
  const key = requireEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

function decrypt(stored: string): string {
  const key = requireEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export interface BrokerageConnection {
  snapTradeUserId: string;
  userSecret: string; // decrypted, in-memory only — never log this
}

export async function getConnectionForUser(userId: string): Promise<BrokerageConnection | null> {
  const { rows } = await getPool().query(
    `SELECT snaptrade_user_id, user_secret_encrypted FROM brokerage_connections WHERE "userId" = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  return {
    snapTradeUserId: rows[0].snaptrade_user_id,
    userSecret: decrypt(rows[0].user_secret_encrypted),
  };
}

export interface UserBrokerageConnection extends BrokerageConnection {
  userId: string;
}

// Used by the generation cron to iterate every user with an active
// connection — the multi-user phase needs no schema/adapter changes
// because this already returns one row per app-user.
export async function listAllConnections(): Promise<UserBrokerageConnection[]> {
  const { rows } = await getPool().query(
    `SELECT "userId", snaptrade_user_id, user_secret_encrypted FROM brokerage_connections`
  );
  return rows.map((r) => ({
    userId: r.userId,
    snapTradeUserId: r.snaptrade_user_id,
    userSecret: decrypt(r.user_secret_encrypted),
  }));
}

export async function saveConnection(
  userId: string,
  snapTradeUserId: string,
  userSecret: string
): Promise<void> {
  await getPool().query(
    `INSERT INTO brokerage_connections ("userId", snaptrade_user_id, user_secret_encrypted)
     VALUES ($1, $2, $3)
     ON CONFLICT ("userId") DO UPDATE SET snaptrade_user_id = $2, user_secret_encrypted = $3`,
    [userId, snapTradeUserId, encrypt(userSecret)]
  );
}
