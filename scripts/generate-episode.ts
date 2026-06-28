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

async function main() {
  const id = getEstDateISO();
  const repo = process.env.GITHUB_REPOSITORY ?? "adsheth1988/podcastportco";
  const audioUrl = `https://github.com/${repo}/releases/download/episode-${id}/${id}.mp3`;

  // Skip if today's episode already exists and is ready
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
    aggregatePortfolioNews(),
    fetchPortfolioSnapshot(),
  ]);
  console.log(
    `[generate] News: ${news.portfolioArticles.length} portfolio + ${news.macroArticles.length} macro`
  );

  // Step 2: Generate script with Claude
  console.log("[generate] Step 2: Generating script with Claude…");
  const script = await generatePodcastScript(news, getMarketDateLabel(), snapshot);
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

main().catch((err) => {
  console.error("[generate] Fatal error:", err);
  process.exit(1);
});
