// ── Marketaux raw response types ──────────────────────────────────────────────

export interface MarketauxHighlight {
  highlight: string;
  sentiment: string;
  sentiment_score: number;
}

export interface MarketauxEntity {
  symbol: string;
  name: string;
  exchange: string;
  exchange_long: string;
  country: string;
  type: string;           // "equity", "index", etc.
  industry: string;
  match_score: number;    // how strongly the article matches this entity
  sentiment_score: number; // -1 (bearish) to 1 (bullish)
  highlights: MarketauxHighlight[];
}

export interface MarketauxArticle {
  uuid: string;
  title: string;
  description: string;
  keywords: string;
  snippet: string;
  url: string;
  image_url: string;
  language: string;
  published_at: string;  // ISO 8601
  source: string;
  entities: MarketauxEntity[];
}

export interface MarketauxResponse {
  meta: {
    found: number;
    returned: number;
    limit: number;
    page: number;
  };
  data: MarketauxArticle[];
}

// ── TheNewsAPI raw response types ─────────────────────────────────────────────

export interface TheNewsArticle {
  uuid: string;
  title: string;
  description: string;
  keywords: string;
  snippet: string;
  url: string;
  image_url: string;
  language: string;
  published_at: string;  // ISO 8601
  source: string;
  categories: string[];
  relevance_score: number | null;
}

export interface TheNewsResponse {
  meta: {
    found: number;
    returned: number;
    limit: number;
    page: number;
  };
  data: TheNewsArticle[];
}

// ── App-level aggregated news types ───────────────────────────────────────────
// These are what the rest of the app works with — API responses stay behind
// the news lib boundary.

export interface NewsItem {
  id: string;
  ticker: string | null;         // null for macro/market-wide articles
  company: string | null;        // null for macro articles
  portfolioWeight: number;       // 0 for macro articles
  title: string;
  description: string;
  snippet: string;
  url: string;
  source: string;
  publishedAt: string;           // ISO 8601
  sentimentScore: number;        // -1 (bearish) to 1 (bullish), 0 = unknown
  rankScore: number;             // computed ranking score (higher = more important)
  isMacro: boolean;
}

export interface AggregatedNewsResult {
  portfolioArticles: NewsItem[];  // ticker-specific, sorted by rankScore
  macroArticles: NewsItem[];      // market-wide context
  totalArticles: number;
  fetchedAt: string;             // ISO 8601
  errors: string[];              // non-fatal fetch errors (partial results returned)
}
