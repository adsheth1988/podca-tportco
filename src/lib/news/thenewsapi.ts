import type { TheNewsArticle, TheNewsResponse } from "@/types/news";

const BASE_URL = "https://api.thenewsapi.com/v1/news/all";

function requireApiKey(): string {
  const key = process.env.THENEWSAPI_KEY;
  if (!key) throw new Error("THENEWSAPI_KEY is not set in environment variables");
  return key;
}

// Broad market context: Fed, rates, macro economy, S&P, sector outlook.
// These articles don't mention specific tickers but give the "why" behind
// the day's moves.
export async function fetchMacroNews(limit = 8): Promise<TheNewsArticle[]> {
  const params = new URLSearchParams({
    search:    "stock market earnings Federal Reserve interest rates economy inflation",
    categories: "business",
    language:  "en",
    sort:      "published_at",
    limit:     String(Math.min(limit, 20)),
    api_token: requireApiKey(),
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
    throw new Error(`TheNewsAPI ${response.status}: ${body}`);
  }

  const json: TheNewsResponse = await response.json();
  return json.data ?? [];
}

// Optional: sector-specific macro news (energy, tech, utilities).
// Used when we want broader sector context beyond individual tickers.
export async function fetchSectorNews(
  sectors: string[],
  limit = 5
): Promise<TheNewsArticle[]> {
  const sectorQuery = sectors
    .map(s => `${s.toLowerCase()} stocks`)
    .join(" ");

  const params = new URLSearchParams({
    search:    `${sectorQuery} market outlook analyst`,
    categories: "business",
    language:  "en",
    sort:      "published_at",
    limit:     String(Math.min(limit, 10)),
    api_token: requireApiKey(),
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
    throw new Error(`TheNewsAPI (sector) ${response.status}: ${body}`);
  }

  const json: TheNewsResponse = await response.json();
  return json.data ?? [];
}
