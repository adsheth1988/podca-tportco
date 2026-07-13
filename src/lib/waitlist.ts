import fs from "fs/promises";
import path from "path";

export interface WaitlistEntry {
  email: string;
  createdAt: string;
}

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

// ── Filesystem (local dev) ────────────────────────────────────────────────────

const DATA_FILE = path.join(process.cwd(), "data", "waitlist.json");

async function fsRead(): Promise<WaitlistEntry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as WaitlistEntry[];
  } catch {
    return [];
  }
}

async function fsWrite(entries: WaitlistEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2));
}

// ── Vercel Blob (production) ──────────────────────────────────────────────────

const BLOB_PATH = "waitlist.json";

async function blobRead(): Promise<WaitlistEntry[]> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_PATH });
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as WaitlistEntry[];
  } catch {
    return [];
  }
}

async function blobWrite(entries: WaitlistEntry[]): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(entries, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listWaitlist(): Promise<WaitlistEntry[]> {
  return USE_BLOB ? blobRead() : fsRead();
}

export async function addToWaitlist(email: string): Promise<"added" | "duplicate"> {
  const normalized = email.trim().toLowerCase();
  const entries = await listWaitlist();
  if (entries.some((e) => e.email === normalized)) return "duplicate";

  entries.push({ email: normalized, createdAt: new Date().toISOString() });
  if (USE_BLOB) await blobWrite(entries);
  else await fsWrite(entries);
  return "added";
}
