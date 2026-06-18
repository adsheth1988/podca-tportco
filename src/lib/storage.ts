import fs from "fs/promises";
import path from "path";
import type { Episode } from "@/types/episode";

export type { Episode };

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

// ── Filesystem (local dev) ────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data", "episodes");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function fsSave(episode: Episode): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, `${episode.id}.json`),
    JSON.stringify(episode, null, 2)
  );
}

async function fsGet(id: string): Promise<Episode | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as Episode;
  } catch {
    return null;
  }
}

async function fsList(): Promise<Episode[]> {
  try {
    await ensureDir();
    const files = await fs.readdir(DATA_DIR);
    const episodes: Episode[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      try {
        const raw = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
        const ep = JSON.parse(raw) as Episode;
        episodes.push({ ...ep, script: null });
      } catch {
        // skip corrupt files
      }
    }
    return episodes.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch {
    return [];
  }
}

// ── Vercel Blob (production) ──────────────────────────────────────────────────

const EPISODE_PREFIX = "episodes/";

async function blobSave(episode: Episode): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(`${EPISODE_PREFIX}${episode.id}.json`, JSON.stringify(episode), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

async function blobGet(id: string): Promise<Episode | null> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: `${EPISODE_PREFIX}${id}.json` });
    if (blobs.length === 0) return null;
    const res = await fetch(blobs[0].url);
    if (!res.ok) return null;
    return (await res.json()) as Episode;
  } catch {
    return null;
  }
}

async function blobList(): Promise<Episode[]> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: EPISODE_PREFIX });
    const episodes: Episode[] = [];
    for (const blob of blobs.filter((b) => b.pathname.endsWith(".json"))) {
      try {
        const res = await fetch(blob.url);
        if (!res.ok) continue;
        const ep = (await res.json()) as Episode;
        episodes.push({ ...ep, script: null });
      } catch {
        // skip
      }
    }
    return episodes.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function saveEpisode(episode: Episode): Promise<void> {
  return USE_BLOB ? blobSave(episode) : fsSave(episode);
}

export async function getEpisode(id: string): Promise<Episode | null> {
  return USE_BLOB ? blobGet(id) : fsGet(id);
}

export async function listEpisodes(): Promise<Episode[]> {
  return USE_BLOB ? blobList() : fsList();
}

export async function episodeExists(id: string): Promise<boolean> {
  const ep = await getEpisode(id);
  return ep !== null;
}
