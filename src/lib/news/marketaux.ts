import type { MarketauxArticle, MarketauxResponse } from "@/types/news";

const BASE_URL = "https://api.marketaux.com/v1/news/all";

function requireApiKey(): string {
  const key = process.env.MARKETAUX_API_KEY;
  if (!key) throw new Error("MARKETAUX_API_KEY is not set in environment variables");
  return key;
}

interface FetchTickerNewsOptions {
  tickers: string[];
  publishedAfter: string;  // "YYYY-MM-DDTHH:mm:ss" UTC
  limit?: number;          // max 100 on free tier
}

// Fetches all articles mentioning any of the given tickers.
// Marketaux supports comma-separated symbols in one request — efficient on rate limits.
export async function fetchTickerNews(
  options: FetchTickerNewsOptions
): Promise<MarketauxArticle[]> {
  const { tickers, publishedAfter, limit = 50 } = options;

  const params = new URLSearchParams({
    symbols:         tickers.join(","),
    filter_entities: "true",      // only return articles where entities are confirmed
    published_after: publishedAfter,
    language:        "en",
    sort:            "published_at",
    limit:           String(Math.min(limit, 100)),
    api_token:       requireApiKey(),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Marketaux API ${response.status}: ${body}`);
  }

  const json: MarketauxResponse = await response.json();
  return json.data ?? [];
}

// Returns the average sentiment score across entities that match our portfolio tickers.
// Returns 0 (neutral) if no matching entities are found.
export function extractEntitySentiment(
  article: MarketauxArticle,
  portfolioTickers: Set<string>
): number {
  const matchingEntities = article.entities.filter(e =>
    portfolioTickers.has(e.symbol)
  );
  if (matchingEntities.length === 0) return 0;

  const total = matchingEntities.reduce((sum, e) => sum + e.sentiment_score, 0);
  return total / matchingEntities.length;
}

// Returns our portfolio tickers that appear in this article,
// sorted by match_score descending (most relevant ticker first).
export function extractMatchingTickers(
  article: MarketauxArticle,
  portfolioTickers: Set<string>
): string[] {
  return article.entities
    .filter(e => portfolioTickers.has(e.symbol))
    .sort((a, b) => b.match_score - a.match_score)
    .map(e => e.symbol);
}
