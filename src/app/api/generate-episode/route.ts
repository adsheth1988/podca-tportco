import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { aggregatePortfolioNews } from "@/lib/news/aggregator";
import { generatePodcastScript, countWords } from "@/script/generator";
import { generateAudio, estimateDurationSeconds, withIntroStinger } from "@/audio/tts";
import { fetchPortfolioSnapshot } from "@/lib/prices";
import { saveEpisode, getEpisode } from "@/lib/storage";

function getEstDateISO(): string {
  const estString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  return new Date(estString).toISOString().slice(0, 10);
}

function getEstDateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/New_York",
  });
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me-to-a-random-string") return true;
  const authHeader = req.headers.get("authorization");
  // No header = browser request, always allow
  if (!authHeader) return true;
  // Header present (e.g. cron job) = must match secret
  return authHeader === `Bearer ${secret}`;
}

export const maxDuration = 120;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = getEstDateISO();

  const existing = await getEpisode(id);
  if (existing && existing.status === "ready") {
    return NextResponse.json({ message: "Episode already exists for today", id });
  }

  const startTime = Date.now();

  try {
    // Step 1: Fetch news + prices in parallel
    console.log(`[generate-episode] Fetching news + prices for ${id}…`);
    const [news, snapshot] = await Promise.all([
      aggregatePortfolioNews(),
      fetchPortfolioSnapshot(),
    ]);

    // Step 2: Generate script
    console.log(`[generate-episode] Generating script with Claude…`);
    const script = await generatePodcastScript(news, getEstDateLabel(), snapshot);
    const wordCount = countWords(script);

    // Step 3: Synthesize audio
    console.log(`[generate-episode] Synthesizing audio (${wordCount} words)…`);
    const audioBuffer = await withIntroStinger(await generateAudio(script));

    // Save audio — Vercel Blob in production, local filesystem in dev
    let audioUrl: string;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        const { url } = await put(`audio/${id}.mp3`, audioBuffer, {
          access: "public",
          contentType: "audio/mpeg",
          addRandomSuffix: false,
        });
        audioUrl = url;
      } catch (blobErr) {
        const msg = blobErr instanceof Error ? blobErr.message : String(blobErr);
        throw new Error(`Blob audio upload failed — check BLOB_READ_WRITE_TOKEN is correctly linked in Vercel Storage: ${msg}`);
      }
    } else {
      const audioDir = path.join(process.cwd(), "public", "audio");
      await fs.mkdir(audioDir, { recursive: true });
      await fs.writeFile(path.join(audioDir, `${id}.mp3`), audioBuffer);
      audioUrl = `/audio/${id}.mp3`;
    }

    // Step 4: Persist episode metadata
    const episode = {
      id,
      date: id,
      status: "ready" as const,
      script,
      audioUrl,
      durationSeconds: estimateDurationSeconds(wordCount),
      wordCount,
      articleCount: news.totalArticles,
      generatedAt: new Date().toISOString(),
      errorMessage: null,
      createdAt: new Date().toISOString(),
    };

    await saveEpisode(episode);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[generate-episode] Done in ${elapsed}s — ${audioBuffer.length / 1024 | 0}KB audio`);

    return NextResponse.json({ success: true, id, audioUrl, wordCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generate-episode] Failed:`, message);

    // Save a failed episode record so we know it was attempted
    await saveEpisode({
      id,
      date: id,
      status: "failed",
      script: null,
      audioUrl: null,
      durationSeconds: null,
      wordCount: null,
      articleCount: null,
      generatedAt: null,
      errorMessage: message,
      createdAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allow GET for easy browser-based testing during dev
export async function GET(req: NextRequest) {
  return POST(req);
}
