#!/usr/bin/env tsx
/**
 * Dead-man's-switch for the daily generation pipeline.
 *
 * Runs on its own schedule, well after the 4:45 PM ET generation cron
 * should have finished, and checks whether today's episode actually
 * exists with status "ready". This catches failure modes the pipeline's
 * own error handling can't see: the workflow not firing at all (cron
 * misfire, Actions outage), or it firing and dying before it could write
 * anything or call notifyFailure() itself.
 *
 * Run: npx tsx scripts/check-episode-heartbeat.ts
 */

import path from "path";
import fs from "fs/promises";
import { notifyFailure } from "../src/lib/alerts";
import { getEstDateISO, isTradingDay } from "../src/lib/market-calendar";
import type { Episode } from "../src/types/episode";

async function main() {
  const id = getEstDateISO();

  if (!isTradingDay(id)) {
    console.log(`[heartbeat] ${id} is not a trading day — no episode expected, skipping.`);
    return;
  }

  const episodePath = path.join(process.cwd(), "public", "data", "episodes", `${id}.json`);

  let episode: Episode | null = null;
  try {
    episode = JSON.parse(await fs.readFile(episodePath, "utf-8")) as Episode;
  } catch {
    episode = null;
  }

  if (episode?.status === "ready") {
    console.log(`[heartbeat] ${id} is ready — pipeline healthy.`);
    return;
  }

  const message = episode
    ? `Episode ${id} exists but has status "${episode.status}", not "ready". ${episode.errorMessage ?? ""}`.trim()
    : `No episode file found for ${id}. The 4:45 PM ET generation workflow may not have run at all — check the Actions tab for "Daily Podcast Generation".`;

  console.error(`[heartbeat] ${message}`);
  await notifyFailure({ episodeId: id, step: "heartbeat-check", message });
}

main().catch((err) => {
  console.error("[heartbeat] Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
