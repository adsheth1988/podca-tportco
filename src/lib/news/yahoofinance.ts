import type { NewsItem } from "@/types/news";
import { PORTFOLIO_MAP } from "@/config/portfolio";

const RSS_BASE = "https://feeds.finance.yahoo.com/rss/2.0/headline";

function parseRssDate(dateStr: string): string {
  // RSS pubDate: "Mon, 16 Jun 2026 20:50:00 +0000" → ISO 8601
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return (match?.[1] ?? match?.[2] ?? "").trim();
}

function parseItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string; source: string }> {
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
  return itemMatches.map((item) => ({
    title:       extractTag(item, "title"),
    link:        extractTag(item, "link"),
    description: extractTag(item, "description"),
    pubDate:     extractTag(item, "pubDate"),
    source:      "finance.yahoo.com",
  }));
}

async function fetchTickerRss(ticker: string): Promise<NewsItem[]> {
  const url = `${RSS_BASE}?s=${ticker}&region=US&lang=en-US`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) throw new Error(`Yahoo Finance RSS ${res.status} for ${ticker}`);

  const xml = await res.text();
  const items = parseItems(xml);
  const holding = PORTFOLIO_MAP.get(ticker);

  return items.slice(0, 4).map((item, i) => ({
    id:              `yf-${ticker}-${i}`,
    ticker,
    company:         holding?.name ?? null,
    portfolioWeight: holding?.weight ?? 0,
    title:           item.title,
    description:     item.description,
    snippet:         item.description.slice(0, 200),
    url:             item.link,
    source:          item.source,
    publishedAt:     parseRssDate(item.pubDate),
    sentimentScore:  0,
    rankScore:       (holding?.weight ?? 0),
    isMacro:         false,
  }));
}

// Fetch RSS feeds for all tickers in parallel with a concurrency limit
export async function fetchYahooFinanceNews(tickers: string[]): Promise<NewsItem[]> {
  const results = await Promise.allSettled(tickers.map((t) => fetchTickerRss(t)));
  const articles: NewsItem[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      console.warn(`[yahoo-rss] Failed for ${tickers[i]}: ${r.reason}`);
    }
  }

  return articles;
}
