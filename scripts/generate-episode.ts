#!/usr/bin/env tsx
/**
 * Standalone pipeline script — runs in GitHub Actions (or locally).
 * Generates an episode for each configured podcast (QQQ, SOXX, MEME):
 * fetches news → generates script → synthesizes audio → writes output files.
 *
 * QQQ keeps its original (pre-multi-podcast) file layout so nothing that
 * already reads it needs to change:
 *   public/audio/{date}.mp3          (gitignored — uploaded to GitHub Releases)
 *   public/data/episodes/{date}.json (full episode with script)
 *   public/data/episodes.json        (list of all episodes, no scripts)
 *
 * SOXX/MEME use a slug-prefixed layout to avoid colliding with QQQ or each
 * other on the same date:
 *   public/audio/{slug}-{date}.mp3
 *   public/data/episodes/{slug}/{date}.json
 *   public/data/episodes-{slug}.json
 */

import path from "path";
import fs from "fs/promises";
import { aggregatePortfolioNews } from "../src/lib/news/aggregator";
import { generatePodcastScript, countWords, hasPerHoldingDollarLeak } from "../src/script/generator";
import { generateAudio, estimateDurationSeconds } from "../src/audio/tts";
import { fetchPortfolioSnapshot } from "../src/lib/prices";
import { PORTFOLIO_HOLDINGS, type Holding } from "../src/config/portfolio";
import { SOXX_HOLDINGS } from "../src/config/soxx";
import { MEME_HOLDINGS } from "../src/config/meme";
import { QQQ_PODCAST, SOXX_PODCAST, MEME_PODCAST, type PodcastIdentity } from "../src/config/podcasts";
import type { Episode } from "../src/types/episode";

function getEstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function getEstDateISO(): string {
  return getEstNow().toISOString().slice(0, 10);
}

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

function isWeekendRun(): boolean {
  const day = getEstNow().getDay();
  return day === 0 || day === 6;
}

// NYSE market holidays — no trading, no episode.
// Source: NYSE holiday schedule (https://www.nyse.com/markets/hours-calendars)
// Update this list each January for the new year.
const NYSE_HOLIDAYS = new Set([
  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr. Day
  "2026-02-16", // Presidents' Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth National Independence Day
  "2026-07-03", // Independence Day (observed — July 4 falls on Saturday)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving Day
  "2026-12-25", // Christmas Day
  // 2027
  "2027-01-01", // New Year's Day
  "2027-01-18", // Martin Luther King Jr. Day
  "2027-02-15", // Presidents' Day
  "2027-04-23", // Good Friday
  "2027-05-31", // Memorial Day
  "2027-06-18", // Juneteenth (observed — June 19 falls on Saturday)
  "2027-07-05", // Independence Day (observed — July 4 falls on Sunday)
  "2027-09-06", // Labor Day
  "2027-11-25", // Thanksgiving Day
  "2027-12-24", // Christmas Day (observed — December 25 falls on Saturday)
]);

interface PodcastConfig {
  slug: string;
  holdings: Holding[];
  identity: PodcastIdentity;
  legacyPaths: boolean; // true only for QQQ — keeps its pre-existing unprefixed paths
}

const PODCASTS: PodcastConfig[] = [
  { slug: "qqq",  holdings: PORTFOLIO_HOLDINGS, identity: QQQ_PODCAST,  legacyPaths: true },
  { slug: "soxx", holdings: SOXX_HOLDINGS,      identity: SOXX_PODCAST, legacyPaths: false },
  { slug: "meme", holdings: MEME_HOLDINGS,      identity: MEME_PODCAST, legacyPaths: false },
];

async function generateOne(config: PodcastConfig, id: string, repo: string): Promise<void> {
  const { slug, holdings, identity, legacyPaths } = config;
  const audioFileName = legacyPaths ? `${id}.mp3` : `${slug}-${id}.mp3`;
  const releaseTag = legacyPaths ? `episode-${id}` : `episode-${slug}-${id}`;
  const audioUrl = `https://github.com/${repo}/releases/download/${releaseTag}/${audioFileName}`;
  const listPath = legacyPaths
    ? path.join(process.cwd(), "public", "data", "episodes.json")
    : path.join(process.cwd(), "public", "data", `episodes-${slug}.json`);
  const episodesDir = legacyPaths
    ? path.join(process.cwd(), "public", "data", "episodes")
    : path.join(process.cwd(), "public", "data", "episodes", slug);

  // Skip if today's episode already exists and is ready (handles DST double-trigger)
  try {
    const existing = JSON.parse(await fs.readFile(listPath, "utf-8")) as Episode[];
    const todayEp = existing.find((e) => e.id === id);
    if (todayEp?.status === "ready") {
      console.log(`[generate:${slug}] Episode ${id} already ready — skipping.`);
      return;
    }
  } catch {
    // No list file yet — first run for this podcast
  }

  console.log(`[generate:${slug}] Starting episode ${id}…`);

  // Step 1: Fetch news + prices in parallel
  console.log(`[generate:${slug}] Step 1: Fetching news + prices…`);
  const [news, snapshot] = await Promise.all([
    aggregatePortfolioNews(holdings),
    fetchPortfolioSnapshot(holdings),
  ]);
  console.log(
    `[generate:${slug}] News: ${news.portfolioArticles.length} portfolio + ${news.macroArticles.length} macro`
  );

  // Step 2: Generate script with Claude
  console.log(`[generate:${slug}] Step 2: Generating script with Claude…`);
  let script = await generatePodcastScript(
    news, getMarketDateLabel(), snapshot, isWeekendRun(), holdings, identity
  );

  // One retry if the percent-only guardrail trips — if it trips twice, fail
  // loudly rather than publish an episode with a leaked per-holding price.
  if (hasPerHoldingDollarLeak(script, identity)) {
    console.log(`[generate:${slug}] Dollar-figure leak detected, retrying script generation…`);
    script = await generatePodcastScript(
      news, getMarketDateLabel(), snapshot, isWeekendRun(), holdings, identity
    );
    if (hasPerHoldingDollarLeak(script, identity)) {
      throw new Error(`[generate:${slug}] Generated script leaked a per-holding dollar figure twice — aborting`);
    }
  }

  const wordCount = countWords(script);
  const durationSeconds = estimateDurationSeconds(wordCount);
  console.log(`[generate:${slug}] Script: ${wordCount} words (~${Math.round(durationSeconds / 60)} min)`);

  // Step 3: Synthesize audio
  console.log(`[generate:${slug}] Step 3: Synthesizing audio…`);
  const audioBuffer = await generateAudio(script);
  console.log(`[generate:${slug}] Audio: ${Math.round(audioBuffer.length / 1024)}KB`);

  // Save MP3 (gitignored — GH Actions will upload to GitHub Releases)
  const audioDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(audioDir, { recursive: true });
  await fs.writeFile(path.join(audioDir, audioFileName), audioBuffer);
  console.log(`[generate:${slug}] Saved public/audio/${audioFileName}`);

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
  await fs.mkdir(episodesDir, { recursive: true });
  await fs.writeFile(
    path.join(episodesDir, `${id}.json`),
    JSON.stringify(episode, null, 2)
  );
  console.log(`[generate:${slug}] Saved ${path.relative(process.cwd(), episodesDir)}/${id}.json`);

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
  console.log(`[generate:${slug}] Updated ${path.relative(process.cwd(), listPath)} (${episodes.length} total)`);

  console.log(`[generate:${slug}] Done! Audio will be at: ${audioUrl}`);
}

async function main() {
  const id = getEstDateISO();
  const repo = process.env.GITHUB_REPOSITORY ?? "adsheth1988/podcastportco";

  // Skip NYSE holidays — market closed, no data worth reporting
  if (NYSE_HOLIDAYS.has(id)) {
    console.log(`[generate] ${id} is a NYSE holiday — no episodes today.`);
    process.exit(0);
  }

  let anyFailed = false;
  for (const config of PODCASTS) {
    console.log(`\n[generate] === ${config.slug.toUpperCase()} ===`);
    try {
      await generateOne(config, id, repo);
    } catch (err) {
      anyFailed = true;
      console.error(`[generate:${config.slug}] Failed:`, err);
    }
  }

  if (anyFailed) process.exit(1);
}

main().catch((err) => {
  console.error("[generate] Fatal error:", err);
  process.exit(1);
});
