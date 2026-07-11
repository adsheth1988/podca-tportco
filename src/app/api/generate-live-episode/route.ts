import { NextRequest, NextResponse } from "next/server";
import { aggregatePortfolioNews } from "@/lib/news/aggregator";
import { generatePodcastScript, countWords, hasPerHoldingDollarLeak } from "@/script/generator";
import { generateAudio, estimateDurationSeconds, withIntroStinger } from "@/audio/tts";
import { fetchPortfolioSnapshot } from "@/lib/prices";
import { fetchLiveHoldings } from "@/lib/snaptrade/adapter";
import { listAllConnections } from "@/lib/db/connections";
import { savePersonalEpisode, getPersonalEpisode } from "@/lib/db/personalEpisodes";
import { PERSONAL_PODCAST } from "@/config/podcasts";

// Triggered by Vercel Cron (see vercel.json) — not user-facing. Iterates
// every user with an active brokerage connection; this is the entire
// multi-user diff the plan called for (no schema/adapter changes needed).
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow (matches existing generate-episode route's fallback)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

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

export const maxDuration = 120;
export const runtime = "nodejs";

async function generateForUser(userId: string, snapTradeUserId: string, userSecret: string) {
  const date = getEstDateISO();

  const existing = await getPersonalEpisode(userId, date);
  if (existing?.status === "ready") return { userId, skipped: true };

  try {
    const { holdings, portfolioTotalValue } = await fetchLiveHoldings(snapTradeUserId, userSecret);
    if (holdings.length === 0) {
      throw new Error("No equity/ETF holdings found in linked accounts");
    }

    const [news, snapshot] = await Promise.all([
      aggregatePortfolioNews(holdings),
      fetchPortfolioSnapshot(holdings, portfolioTotalValue),
    ]);

    let script = await generatePodcastScript(
      news, getEstDateLabel(), snapshot, false, holdings, PERSONAL_PODCAST
    );

    // One retry if the dollar-leak guardrail trips — if it trips twice, fail
    // loudly rather than publish an episode that may reveal position sizes.
    if (hasPerHoldingDollarLeak(script, PERSONAL_PODCAST)) {
      script = await generatePodcastScript(
        news, getEstDateLabel(), snapshot, false, holdings, PERSONAL_PODCAST
      );
      if (hasPerHoldingDollarLeak(script, PERSONAL_PODCAST)) {
        throw new Error("Generated script leaked a per-holding dollar figure twice — aborting");
      }
    }

    const wordCount = countWords(script);
    const audioBuffer = await withIntroStinger(await generateAudio(script));

    const { put } = await import("@vercel/blob");
    const { url: audioUrl } = await put(`personal-audio/${userId}/${date}.mp3`, audioBuffer, {
      access: "public",
      contentType: "audio/mpeg",
      addRandomSuffix: false,
    });

    await savePersonalEpisode(userId, date, {
      status: "ready",
      script,
      audioUrl,
      durationSeconds: estimateDurationSeconds(wordCount),
      wordCount,
      articleCount: news.totalArticles,
      generatedAt: new Date().toISOString(),
      errorMessage: null,
    });

    return { userId, wordCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await savePersonalEpisode(userId, date, { status: "failed", errorMessage: message }).catch(() => {});
    return { userId, error: message };
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await listAllConnections();
  const results = await Promise.all(
    connections.map((c) => generateForUser(c.userId, c.snapTradeUserId, c.userSecret))
  );

  return NextResponse.json({ results });
}
