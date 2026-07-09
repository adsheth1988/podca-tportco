import {
  fetchTickerNews,
  extractEntitySentiment,
  extractMatchingTickers,
} from "./marketaux";
import { fetchMacroNews } from "./thenewsapi";
import { fetchYahooFinanceNews } from "./yahoofinance";
import type { Holding } from "@/config/portfolio";
import type {
  AggregatedNewsResult,
  NewsItem,
  MarketauxArticle,
  TheNewsArticle,
} from "@/types/news";

// ── Source blocklist ───────────────────────────────────────────────────────────
// Articles from these domains are dropped before the script generator sees them.
const BLOCKED_SOURCES = new Set([
  "zacks.com",
  "substack.com",
]);

function isBlocked(source: string): boolean {
  const domain = source.toLowerCase();
  for (const blocked of BLOCKED_SOURCES) {
    if (domain.includes(blocked)) return true;
  }
  return false;
}

// ── Ranking ────────────────────────────────────────────────────────────────────

function recencyMultiplier(publishedAt: string): number {
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  if (ageHours <  4) return 1.00;
  if (ageHours <  8) return 0.90;
  if (ageHours < 12) return 0.80;
  if (ageHours < 18) return 0.65;
  if (ageHours < 24) return 0.50;
  return 0.30;
}

function computeRankScore(
  portfolioWeight: number,
  sentimentScore: number,
  publishedAt: string
): number {
  const recency = recencyMultiplier(publishedAt);
  const sentimentBonus = 1 + Math.abs(sentimentScore) * 0.25;
  return portfolioWeight * recency * sentimentBonus;
}

// ── Deduplication ──────────────────────────────────────────────────────────────

function deduplicateByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url.split("?")[0].toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Date helper ────────────────────────────────────────────────────────────────

function getPublishedAfterTimestamp(): string {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

// ── Mappers ────────────────────────────────────────────────────────────────────

function mapMarketauxArticle(
  article: MarketauxArticle,
  portfolioTickers: Set<string>,
  holdingMap: Map<string, Holding>
): NewsItem | null {
  const matchingTickers = extractMatchingTickers(article, portfolioTickers);
  if (matchingTickers.length === 0) return null;
  if (isBlocked(article.source)) return null;

  const primaryTicker = matchingTickers[0];
  const holding = holdingMap.get(primaryTicker);
  const portfolioWeight = holding?.weight ?? 0;
  const sentimentScore = extractEntitySentiment(article, portfolioTickers);

  return {
    id:              article.uuid,
    ticker:          primaryTicker,
    company:         holding?.name ?? null,
    portfolioWeight,
    title:           article.title,
    description:     article.description,
    snippet:         article.snippet,
    url:             article.url,
    source:          article.source,
    publishedAt:     article.published_at,
    sentimentScore,
    rankScore:       computeRankScore(portfolioWeight, sentimentScore, article.published_at),
    isMacro:         false,
  };
}

function mapTheNewsArticle(article: TheNewsArticle): NewsItem | null {
  if (isBlocked(article.source)) return null;
  return {
    id:              article.uuid,
    ticker:          null,
    company:         null,
    portfolioWeight: 0,
    title:           article.title,
    description:     article.description,
    snippet:         article.snippet,
    url:             article.url,
    source:          article.source,
    publishedAt:     article.published_at,
    sentimentScore:  0,
    rankScore:       0,
    isMacro:         true,
  };
}

// ── Main aggregator ────────────────────────────────────────────────────────────

export async function aggregatePortfolioNews(holdings: Holding[]): Promise<AggregatedNewsResult> {
  const errors: string[] = [];
  const tickers = holdings.map((h) => h.ticker);
  const portfolioTickers = new Set(tickers);
  const holdingMap = new Map(holdings.map((h) => [h.ticker, h]));
  const publishedAfter = getPublishedAfterTimestamp();

  // Run all three sources in parallel
  const [marketauxResult, yahooResult, macroResult] = await Promise.allSettled([
    fetchTickerNews({ tickers, publishedAfter, limit: 50 }),
    fetchYahooFinanceNews(tickers, holdingMap),
    fetchMacroNews(8),
  ]);

  // ── MarketAux (ticker-filtered, sentiment-scored) ───────────────────────────
  let marketauxArticles: NewsItem[] = [];
  if (marketauxResult.status === "fulfilled") {
    marketauxArticles = marketauxResult.value
      .map((a) => mapMarketauxArticle(a, portfolioTickers, holdingMap))
      .filter((item): item is NewsItem => item !== null);
  } else {
    const msg = `MarketAux fetch failed: ${marketauxResult.reason}`;
    console.error("[aggregator]", msg);
    errors.push(msg);
  }

  // ── Yahoo Finance RSS (ticker-specific, no noise) ───────────────────────────
  let yahooArticles: NewsItem[] = [];
  if (yahooResult.status === "fulfilled") {
    yahooArticles = yahooResult.value
      .filter((a) => !isBlocked(a.source))
      .map((a) => ({
        ...a,
        rankScore: computeRankScore(a.portfolioWeight, a.sentimentScore, a.publishedAt),
      }));
  } else {
    const msg = `Yahoo Finance RSS fetch failed: ${yahooResult.reason}`;
    console.error("[aggregator]", msg);
    errors.push(msg);
  }

  // ── Merge + deduplicate portfolio articles ──────────────────────────────────
  const portfolioArticles = deduplicateByUrl(
    [...marketauxArticles, ...yahooArticles].sort((a, b) => b.rankScore - a.rankScore)
  );

  // ── Macro articles (TheNewsAPI — still good for broad market context) ───────
  let macroArticles: NewsItem[] = [];
  if (macroResult.status === "fulfilled") {
    macroArticles = deduplicateByUrl(
      macroResult.value
        .map(mapTheNewsArticle)
        .filter((item): item is NewsItem => item !== null)
    );
  } else {
    const msg = `TheNewsAPI macro fetch failed: ${macroResult.reason}`;
    console.error("[aggregator]", msg);
    errors.push(msg);
  }

  return {
    portfolioArticles,
    macroArticles,
    totalArticles: portfolioArticles.length + macroArticles.length,
    fetchedAt:     new Date().toISOString(),
    errors,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function groupArticlesByTicker(articles: NewsItem[]): Map<string, NewsItem[]> {
  const grouped = new Map<string, NewsItem[]>();
  for (const article of articles) {
    if (!article.ticker) continue;
    const existing = grouped.get(article.ticker) ?? [];
    existing.push(article);
    grouped.set(article.ticker, existing);
  }
  return grouped;
}

export function selectArticlesForScript(
  portfolioArticles: NewsItem[],
  macroArticles: NewsItem[],
  options = { maxPortfolio: 12, maxMacro: 4 }
): { portfolio: NewsItem[]; macro: NewsItem[] } {
  return {
    portfolio: portfolioArticles.slice(0, options.maxPortfolio),
    macro:     macroArticles.slice(0, options.maxMacro),
  };
}
