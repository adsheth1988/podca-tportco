import fs from "fs/promises";
import path from "path";
import { getSnapTradeClient } from "./client";

const SNAPTRADE_USER_ID = "portfolio-playbook-owner";
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const DATA_FILE = path.join(process.cwd(), "data", "snaptrade-user.json");
const BLOB_PATH = "snaptrade/user.json";

interface SnapTradeUserCredential {
  userId: string;
  userSecret: string;
}

async function readCredential(): Promise<SnapTradeUserCredential | null> {
  if (USE_BLOB) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: BLOB_PATH });
      if (blobs.length === 0) return null;
      const res = await fetch(blobs[0].url);
      if (!res.ok) return null;
      return (await res.json()) as SnapTradeUserCredential;
    } catch {
      return null;
    }
  }

  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as SnapTradeUserCredential;
  } catch {
    return null;
  }
}

async function writeCredential(cred: SnapTradeUserCredential): Promise<void> {
  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, JSON.stringify(cred), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
    return;
  }

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(cred, null, 2));
}

export async function getOrCreateSnapTradeUser(): Promise<SnapTradeUserCredential> {
  const existing = await readCredential();
  if (existing) return existing;

  const snaptrade = getSnapTradeClient();
  const { data } = await snaptrade.authentication.registerSnapTradeUser({
    userId: SNAPTRADE_USER_ID,
  });

  const cred: SnapTradeUserCredential = {
    userId: data.userId!,
    userSecret: data.userSecret!,
  };
  await writeCredential(cred);
  return cred;
}
