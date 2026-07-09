#!/usr/bin/env tsx
/**
 * Standalone pipeline script — runs in GitHub Actions (or locally).
 * Fetches news → generates script → synthesizes audio → writes output files.
 *
 * Output:
 *   public/audio/{date}.mp3          (gitignored — uploaded to GitHub Releases)
 *   public/data/episodes/{date}.json (full episode with script)
 *   public/data/episodes.json        (list of all episodes, no scripts)
 */

import path from "path";
import fs from "fs/promises";
import { aggregatePortfolioNews } from "../src/lib/news/aggregator";
import { generatePodcastScript, countWords } from "../src/script/generator";
import { generateAudio, estimateDurationSeconds } from "../src/audio/tts";
import { fetchPortfolioSnapshot } from "../src/lib/prices";
import { PORTFOLIO_HOLDINGS } from "../src/config/portfolio";
import { QQQ_PODCAST } from "../src/config/podcasts";
import { notifyFailure } from "../src/lib/alerts";
import { NYSE_HOLIDAYS } from "../src/config/nyse-holidays";
import { getEstNow, getEstDateISO, isWeekend, isAtOrAfterEstTime } from "../src/lib/market-calendar";
import type { Episode } from "../src/types/episode";

// Must match the intended ET fire time in .github/workflows/daily-podcast.yml.
const PUBLISH_HOUR = 16;
const PUBLISH_MINUTE = 45; // 4:45 PM ET

// Returns the most recent trading day (Mon–Fri).
// Weekend runs (Sat/Sun) reference Friday's session so the script doesn't
// say "today is Saturday" when all market data is from Friday's close.
function getLastTradingDay(): Date {
  const et = getEstNow();
  const day = et.getDay(); // 0=Sun, 6=Sat
  if (day === 6) et.setDate(et.getDate() - 1); // Sat → Fri
  if (day === 0) et.setDate(et.getDate() - 2); // Sun → Fri
  return et;
}

function getMarketDateLabel(): string {
  return getLastTradingDay().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function main() {
  const id = getEstDateISO();
  const repo = process.env.GITHUB_REPOSITORY ?? "adsheth1988/podcastportco";
  const audioUrl = `https://github.com/${repo}/releases/download/episode-${id}/${id}.mp3`;
  const forceGenerate = process.env.FORCE_GENERATE === "true";

  // Skip NYSE holidays — market closed, no data worth reporting.
  // FORCE_GENERATE (workflow_dispatch's "force" input) bypasses this for
  // one-off manual testing.
  if (NYSE_HOLIDAYS.has(id) && !forceGenerate) {
    console.log(`[generate] ${id} is a NYSE holiday — no episode today. (Pass force: true on a manual run to override.)`);
    process.exit(0);
  }

  // The dual-cron DST trick in daily-podcast.yml only applies to *scheduled*
  // firings — one lands on 4:45 PM ET each season, the other lands an hour
  // early in the off-season. Reject that early firing outright, otherwise it
  // generates with stale, pre-close data and "wins" the race, leaving the
  // correctly-timed firing to find an episode already exists and skip.
  // A manual workflow_dispatch run is unambiguous by nature — there's no
  // "duplicate" trigger to guard against — so this only applies when
  // GitHub Actions reports the run as schedule-triggered.
  const isScheduledRun = process.env.GITHUB_EVENT_NAME === "schedule";
  if (isScheduledRun && !isAtOrAfterEstTime(PUBLISH_HOUR, PUBLISH_MINUTE)) {
    console.log(`[generate] Before ${PUBLISH_HOUR}:${PUBLISH_MINUTE} ET — this is the DST-shifted duplicate trigger, not the real one. Skipping.`);
    process.exit(0);
  }

  // Skip if today's episode already exists and is ready (covers the *other*
  // season's duplicate trigger, which lands an hour late instead of early)
  const listPath = path.join(process.cwd(), "public", "data", "episodes.json");
  try {
    const existing = JSON.parse(await fs.readFile(listPath, "utf-8")) as Episode[];
    const todayEp = existing.find((e) => e.id === id);
    if (todayEp?.status === "ready") {
      console.log(`[generate] Episode ${id} already ready — skipping.`);
      process.exit(0);
    }
  } catch {
    // No episodes.json yet — first run
  }

  console.log(`[generate] Starting episode ${id}…`);

  // Step 1: Fetch news + prices in parallel
  console.log("[generate] Step 1: Fetching news + prices…");
  const [news, snapshot] = await Promise.all([
    aggregatePortfolioNews(PORTFOLIO_HOLDINGS),
    fetchPortfolioSnapshot(PORTFOLIO_HOLDINGS),
  ]);
  console.log(
    `[generate] News: ${news.portfolioArticles.length} portfolio + ${news.macroArticles.length} macro`
  );

  // Step 2: Generate script with Claude
  console.log("[generate] Step 2: Generating script with Claude…");
  const script = await generatePodcastScript(
    news, getMarketDateLabel(), snapshot, isWeekend(), PORTFOLIO_HOLDINGS, QQQ_PODCAST
  );
  const wordCount = countWords(script);
  const durationSeconds = estimateDurationSeconds(wordCount);
  console.log(`[generate] Script: ${wordCount} words (~${Math.round(durationSeconds / 60)} min)`);

  // Step 3: Synthesize audio with Google TTS
  console.log("[generate] Step 3: Synthesizing audio…");
  const audioBuffer = await generateAudio(script);
  console.log(`[generate] Audio: ${Math.round(audioBuffer.length / 1024)}KB`);

  // Save MP3 (gitignored — GH Actions will upload to GitHub Releases)
  const audioDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(audioDir, { recursive: true });
  await fs.writeFile(path.join(audioDir, `${id}.mp3`), audioBuffer);
  console.log(`[generate] Saved public/audio/${id}.mp3`);

  // Build episode record
  const now = new Date().toISOString();
  const episode: Episode = {
    id,
    date: id,
    status: "ready",
    script,
    audioUrl,
    durationSeconds,
    wordCount,
    articleCount: news.totalArticles,
    generatedAt: now,
    errorMessage: null,
    createdAt: now,
  };

  // Save individual episode JSON (includes full script for transcript view)
  const episodesDir = path.join(process.cwd(), "public", "data", "episodes");
  await fs.mkdir(episodesDir, { recursive: true });
  await fs.writeFile(
    path.join(episodesDir, `${id}.json`),
    JSON.stringify(episode, null, 2)
  );
  console.log(`[generate] Saved public/data/episodes/${id}.json`);

  // Update episodes list (strip script to keep the list payload small)
  let episodes: Episode[] = [];
  try {
    episodes = JSON.parse(await fs.readFile(listPath, "utf-8")) as Episode[];
  } catch {
    // First run
  }
  const listEntry: Episode = { ...episode, script: null };
  episodes = [listEntry, ...episodes.filter((e) => e.id !== id)];
  await fs.mkdir(path.dirname(listPath), { recursive: true });
  await fs.writeFile(listPath, JSON.stringify(episodes, null, 2));
  console.log(`[generate] Updated public/data/episodes.json (${episodes.length} total)`);

  console.log(`[generate] Done! Audio will be at: ${audioUrl}`);
}

main().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[generate] Fatal error:", message);
  await notifyFailure({ episodeId: getEstDateISO(), message });
  process.exit(1);
});
