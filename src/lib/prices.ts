import { PORTFOLIO_HOLDINGS } from "@/config/portfolio";

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
  portfolioPnL: number;         // dollar P&L on $100k
  portfolioValue: number;       // current value of $100k
  generatedAtEST: string;       // "June 18, 2026 at 5:02 PM ET"
}

const PORTFOLIO_VALUE = 100_000;

// Normalize top 10 weights to sum to 100% for a clean portfolio calculation
const totalWeight = PORTFOLIO_HOLDINGS.reduce((s, h) => s + h.weight, 0);
const NORMALIZED = PORTFOLIO_HOLDINGS.map((h) => ({
  ...h,
  normalizedWeight: h.weight / totalWeight,
}));

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

export async function fetchPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const results = await Promise.all(
    PORTFOLIO_HOLDINGS.map((h) => fetchPrice(h.ticker))
  );

  const prices: TickerPrice[] = results.filter((r): r is TickerPrice => r !== null);

  // Weighted portfolio return using normalized weights
  let portfolioChangePercent = 0;
  for (const norm of NORMALIZED) {
    const p = prices.find((px) => px.ticker === norm.ticker);
    if (p) portfolioChangePercent += p.changePercent * norm.normalizedWeight;
  }

  const portfolioPnL   = (portfolioChangePercent / 100) * PORTFOLIO_VALUE;
  const portfolioValue = PORTFOLIO_VALUE + portfolioPnL;

  return {
    prices,
    portfolioChangePercent,
    portfolioPnL,
    portfolioValue,
    generatedAtEST: formatEST(new Date()),
  };
}
