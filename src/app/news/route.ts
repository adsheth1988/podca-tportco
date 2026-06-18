import { NextResponse } from "next/server";
import { aggregatePortfolioNews } from "@/lib/news/aggregator";
import { generatePodcastScript, countWords } from "@/script/generator";
import { generateAudio, estimateDurationSeconds } from "@/audio/tts";
import { fetchPortfolioSnapshot } from "@/lib/prices";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";

// Vercel timeout configuration.
// NOTE: Hobby plan caps serverless functions at 10s — this pipeline takes 20-40s.
// You need Vercel Pro (or run locally during validation) for the full pipeline.
// Local dev has no timeout limit.
export const maxDuration = 120; // seconds (requires Vercel Pro in production)

// ── Date helpers ───────────────────────────────────────────────────────────────

function getEstDateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
    timeZone: "America/New_York",
  });
}

function getEstDateISO(): string {
  // Returns "YYYY-MM-DD" in Eastern Time — used as the episode's canonical date
  const estString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const estDate   = new Date(estString);
  return estDate.toISOString().slice(0, 10);
}

// ── Route handler ──────────────────────────────────────────────────────────────

// POST /api/generate
//
// Runs the full pipeline: fetch news → generate script → generate audio.
//
// Returns:
//   { success: true, data: GenerationResult }
//   { success: false, error: string, step: string }
//
// The audioBase64 field contains a base64-encoded MP3.
// Use it in the browser as: new Audio(`data:audio/mpeg;base64,${audioBase64}`)
//
// NOTE: In Slice 5, this route will store the audio in Vercel Blob and save
// the episode to Neon DB instead of returning the raw base64.

export async function POST() {
  const startTime   = Date.now();
  let currentStep   = "init";

  try {
    // ── Step 1: Fetch and aggregate news ──────────────────────────────────────
    currentStep = "news_fetch";
    console.log("[generate] Step 1: Fetching portfolio news...");

    const news = await aggregatePortfolioNews();

    if (news.totalArticles === 0 && news.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          step:    currentStep,
          error:   "No articles fetched. Verify API keys and rate limits.",
          details: news.errors,
        },
        { status: 502 }
      );
    }

    console.log(
      `[generate] News: ${news.portfolioArticles.length} portfolio + ` +
      `${news.macroArticles.length} macro articles`
    );

    // ── Step 2: Generate script with Claude ──────────────────────────────────
    currentStep = "script_generation";
    console.log("[generate] Step 2: Generating script with Claude...");

    const dateLabel = getEstDateLabel();
    const snapshot  = await fetchPortfolioSnapshot();
    const script    = await generatePodcastScript(news, dateLabel, snapshot);
    const wordCount = countWords(script);
    const duration  = estimateDurationSeconds(wordCount);

    console.log(
      `[generate] Script: ${wordCount} words | ` +
      `~${Math.round(duration / 60)} min estimated`
    );

    // ── Step 3: Synthesize audio with Google TTS ──────────────────────────────
    currentStep = "audio_synthesis";
    console.log("[generate] Step 3: Synthesizing audio...");

    const audioBuffer  = await generateAudio(script);
    const audioBase64  = audioBuffer.toString("base64");
    const audioSizeKB  = Math.round(audioBuffer.byteLength / 1024);

    console.log(`[generate] Audio: ${audioSizeKB}KB MP3`);

    // ── Done ──────────────────────────────────────────────────────────────────
    const elapsedMs = Date.now() - startTime;
    console.log(`[generate] Complete in ${(elapsedMs / 1000).toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      data: {
        date:                     getEstDateISO(),
        wordCount,
        estimatedDurationSeconds: duration,
        articleCount:             news.totalArticles,
        script,
        audioBase64,
        audioSizeKB,
        elapsedMs,
        errors: news.errors,    // non-fatal warnings (e.g. one API was slow)
      },
    });

  } catch (err) {
    const message   = err instanceof Error ? err.message : String(err);
    const elapsedMs = Date.now() - startTime;

    console.error(`[generate] Failed at step "${currentStep}": ${message}`);

    return NextResponse.json(
      {
        success: false,
        step:    currentStep,
        error:   message,
        elapsedMs,
      },
      { status: 500 }
    );
  }
}
