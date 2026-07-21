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
import { generatePodcastScript, countWords } from "../src/script/generator";
import { generateAudio, estimateDurationSeconds, withIntroStinger, measureAudioMs, introStingerMs } from "../src/audio/tts";
import { buildChapters, embedChapters } from "../src/audio/chapters";
import { fetchPortfolioSnapshot } from "../src/lib/prices";
import { PORTFOLIO_HOLDINGS, type Holding } from "../src/config/portfolio";
import { SOXX_HOLDINGS } from "../src/config/soxx";
import { MEME_HOLDINGS } from "../src/config/meme";
import { QQQ_PODCAST, SOXX_PODCAST, MEME_PODCAST, type PodcastIdentity } from "../src/config/podcasts";
import { notifyFailure } from "../src/lib/alerts";
import { NYSE_HOLIDAYS } from "../src/config/nyse-holidays";
import { getEstNow, getEstDateISO, isWeekend, isAtOrAfterEstTime } from "../src/lib/market-calendar";
import type { Episode, EpisodeChapter } from "../src/types/episode";

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

  // Skip if today's episode already exists and is ready (covers the *other*
  // season's duplicate trigger, which lands an hour late instead of early)
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
  const script = await generatePodcastScript(
    news, getMarketDateLabel(), snapshot, isWeekend(), holdings, identity
  );

  // Note: no per-holding dollar-leak guardrail here. These are public ETF
  // tickers, so a stray per-holding price isn't a privacy concern (unlike the
  // personal podcast, which keeps its guardrail in the live-episode route).
  // The prompt already instructs percent-only per holding; a hard abort here
  // false-positived on legitimate news dollar figures ("billion dollars") and
  // took the whole daily pipeline down.

  const wordCount = countWords(script);
  console.log(`[generate:${slug}] Script: ${wordCount} words`);

  // Step 3: Synthesize audio (with the shared spoken intro stinger prepended)
  console.log(`[generate:${slug}] Step 3: Synthesizing audio…`);
  let audioBuffer = await withIntroStinger(await generateAudio(script));

  // Measure the real audio length (the word-count estimate under-reports it)
  // and derive chapter markers on that true timeline. Both are best-effort —
  // any failure here must never break episode generation.
  let durationSeconds = estimateDurationSeconds(wordCount);
  let chapters: EpisodeChapter[] = [];
  try {
    const totalMs = measureAudioMs(audioBuffer);
    if (totalMs > 0) {
      durationSeconds = Math.round(totalMs / 1000);
      const stingerMs = await introStingerMs();
      chapters = buildChapters(script, holdings, totalMs, stingerMs);
      if (chapters.length > 0) {
        audioBuffer = embedChapters(audioBuffer, chapters, totalMs);
        console.log(`[generate:${slug}] Embedded ${chapters.length} chapters`);
      }
    }
  } catch (err) {
    console.warn(`[generate:${slug}] Chapter embedding skipped:`, err instanceof Error ? err.message : err);
  }
  console.log(`[generate:${slug}] Audio: ${Math.round(audioBuffer.length / 1024)}KB (~${Math.round(durationSeconds / 60)} min)`);

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
    chapters,
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
  const forceGenerate = process.env.FORCE_GENERATE === "true";

  // Skip NYSE holidays — market closed, no data worth reporting.
  // FORCE_GENERATE (workflow_dispatch's "force" input) bypasses this for
  // one-off manual testing.
  if (NYSE_HOLIDAYS.has(id) && !forceGenerate) {
    console.log(`[generate] ${id} is a NYSE holiday — no episodes today. (Pass force: true on a manual run to override.)`);
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

  let anyFailed = false;
  for (const config of PODCASTS) {
    console.log(`\n[generate] === ${config.slug.toUpperCase()} ===`);
    try {
      await generateOne(config, id, repo);
    } catch (err) {
      anyFailed = true;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[generate:${config.slug}] Failed:`, message);
      await notifyFailure({ episodeId: `${id} (${config.slug})`, message });
    }
  }

  if (anyFailed) process.exit(1);
}

main().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[generate] Fatal error:", message);
  await notifyFailure({ episodeId: getEstDateISO(), message });
  process.exit(1);
});
