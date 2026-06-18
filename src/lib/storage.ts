import fs from "fs/promises";
import path from "path";
import type { Episode } from "@/types/episode";

export type { Episode };

const DATA_DIR = path.join(process.cwd(), "data", "episodes");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function saveEpisode(episode: Episode): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, `${episode.id}.json`),
    JSON.stringify(episode, null, 2)
  );
}

export async function getEpisode(id: string): Promise<Episode | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as Episode;
  } catch {
    return null;
  }
}

export async function listEpisodes(): Promise<Episode[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const episodes: Episode[] = [];

  for (const file of files.filter((f) => f.endsWith(".json"))) {
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
      const ep = JSON.parse(raw) as Episode;
      // Strip script from list view to keep payload small
      episodes.push({ ...ep, script: null });
    } catch {
      // skip corrupt files
    }
  }

  return episodes.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function episodeExists(id: string): Promise<boolean> {
  try {
    await fs.access(path.join(DATA_DIR, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}
