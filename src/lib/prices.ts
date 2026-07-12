import type { Holding } from "@/config/portfolio";
import { mapWithConcurrency } from "@/lib/concurrency";

const PRICE_FETCH_CONCURRENCY = 6;

export interface TickerPrice {
  ticker: string;
  price: number;
  previousClose: number;
  changePercent: number;
  changeDollar: number;
}

export interface PortfolioSnapshot {
  prices: TickerPrice[];
  portfolioChangePercent: number;
  portfolioPnL: number;         // dollar P&L on baseValue
  portfolioValue: number;       // current value (baseValue + P&L)
  generatedAtEST: string;       // "June 18, 2026 at 5:02 PM ET"
}

const DEFAULT_QQQ_BASE_VALUE = 100_000; // fictional tracking base for the QQQ podcast

async function fetchPrice(ticker: string): Promise<TickerPrice | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2d`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice as number;
    const prev  = meta.chartPreviousClose as number;
    const changePercent = ((price - prev) / prev) * 100;
    const changeDollar  = price - prev;

    return { ticker, price, previousClose: prev, changePercent, changeDollar };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function formatEST(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(",", "") + " ET";
}

// Pure weighting/P&L math, extracted from fetchPortfolioSnapshot so it's
// unit-testable without mocking the network fetch. Same filter/normalize/sum
// logic as before — this is a strict extraction, not a behavior change.
//
// The spoken "portfolio closed X%" figure reflects only the holdings marked
// isPrimaryFocus (undefined counts as primary) — secondary/fallback-only
// holdings (news sources, never discussed on air) are excluded so the
// announced number always matches what the episode talks about.
//
// baseValue: for the QQQ podcast this is the fictional $100k tracking base;
// for the personal podcast, pass the real SnapTrade-derived portfolio total
// so portfolioValue/portfolioPnL reflect the user's actual account value.
export function computeWeightedSnapshot(
  holdings: Holding[],
  prices: TickerPrice[],
  baseValue: number
): Omit<PortfolioSnapshot, "generatedAtEST"> {
  const primaryHoldings = holdings.filter((h) => h.isPrimaryFocus !== false);
  const totalWeight = primaryHoldings.reduce((s, h) => s + h.weight, 0);
  const normalized = primaryHoldings.map((h) => ({
    ...h,
    normalizedWeight: totalWeight > 0 ? h.weight / totalWeight : 0,
  }));

  // Weighted portfolio return using normalized weights
  let portfolioChangePercent = 0;
  for (const norm of normalized) {
    const p = prices.find((px) => px.ticker === norm.ticker);
    if (p) portfolioChangePercent += p.changePercent * norm.normalizedWeight;
  }

  const portfolioPnL   = (portfolioChangePercent / 100) * baseValue;
  const portfolioValue = baseValue + portfolioPnL;

  return { prices, portfolioChangePercent, portfolioPnL, portfolioValue };
}

export async function fetchPortfolioSnapshot(
  holdings: Holding[],
  baseValue: number = DEFAULT_QQQ_BASE_VALUE
): Promise<PortfolioSnapshot> {
  // Yahoo's chart endpoint is unauthenticated and undocumented — cap
  // concurrency instead of firing all requests at once.
  const results = await mapWithConcurrency(
    holdings,
    PRICE_FETCH_CONCURRENCY,
    (h) => fetchPrice(h.ticker)
  );

  const prices: TickerPrice[] = results
    .filter((r): r is PromiseFulfilledResult<TickerPrice | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is TickerPrice => v !== null);

  return {
    ...computeWeightedSnapshot(holdings, prices, baseValue),
    generatedAtEST: formatEST(new Date()),
  };
}
