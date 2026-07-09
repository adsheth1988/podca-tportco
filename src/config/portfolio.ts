// QQQ Nasdaq-100 top 20 holdings — single source of truth for the portfolio.
// Weights sourced from Invesco fact sheet (late June 2026). Update quarterly.
// Top 9 are primary podcast focus; 10-20 are fallback news sources.
// Note: GOOGL and GOOG (same company, different share classes) combined into GOOGL position.
// SpaceX (SPCX) joined the Nasdaq-100 on 2026-07-07 via fast-track inclusion;
// weight is a working estimate (JPMorgan ~1.3%) pending confirmed float-adjusted figure.

export interface Holding {
  ticker: string;
  name: string;
  weight: number; // % allocation in QQQ
  sector: string;
  isPrimaryFocus?: boolean; // true = top 9 (covered in holdings rundown)
}

export const PORTFOLIO_HOLDINGS: Holding[] = [
  { ticker: "NVDA",  name: "NVIDIA Corporation",            weight:  7.60, sector: "Technology", isPrimaryFocus: true },
  { ticker: "AAPL",  name: "Apple Inc.",                    weight:  6.80, sector: "Technology", isPrimaryFocus: true },
  { ticker: "MU",    name: "Micron Technology, Inc.",       weight:  5.75, sector: "Technology", isPrimaryFocus: true },
  { ticker: "MSFT",  name: "Microsoft Corporation",         weight:  4.52, sector: "Technology", isPrimaryFocus: true },
  { ticker: "AMZN",  name: "Amazon.com, Inc.",              weight:  4.08, sector: "Consumer Discretionary", isPrimaryFocus: true },
  { ticker: "AMD",   name: "Advanced Micro Devices, Inc.",  weight:  3.83, sector: "Technology", isPrimaryFocus: true },
  { ticker: "GOOGL", name: "Alphabet Inc. (Google)",        weight:  6.18, sector: "Communication Services", isPrimaryFocus: true }, // GOOGL + GOOG combined
  { ticker: "TSLA",  name: "Tesla, Inc.",                   weight:  3.09, sector: "Consumer Discretionary", isPrimaryFocus: true },
  { ticker: "INTC",  name: "Intel Corporation",             weight:  2.90, sector: "Technology", isPrimaryFocus: true },
  { ticker: "AVGO",  name: "Broadcom Inc.",                 weight:  2.82, sector: "Technology", isPrimaryFocus: false },
  { ticker: "META",  name: "Meta Platforms, Inc.",          weight:  2.66, sector: "Communication Services", isPrimaryFocus: false },
  { ticker: "WMT",   name: "Walmart Inc.",                  weight:  2.54, sector: "Consumer Defensive", isPrimaryFocus: false },
  { ticker: "AMAT",  name: "Applied Materials, Inc.",       weight:  2.24, sector: "Technology", isPrimaryFocus: false },
  { ticker: "LRCX",  name: "Lam Research Corporation",      weight:  2.13, sector: "Technology", isPrimaryFocus: false },
  { ticker: "CSCO",  name: "Cisco Systems, Inc.",           weight:  2.02, sector: "Technology", isPrimaryFocus: false },
  { ticker: "COST",  name: "Costco Wholesale Corporation",  weight:  1.90, sector: "Consumer Defensive", isPrimaryFocus: false },
  { ticker: "KLAC",  name: "KLA Corporation",               weight:  1.46, sector: "Technology", isPrimaryFocus: false },
  { ticker: "NFLX",  name: "Netflix, Inc.",                 weight:  1.40, sector: "Communication Services", isPrimaryFocus: false },
  { ticker: "SNDK",  name: "Sandisk Corporation",           weight:  1.39, sector: "Technology", isPrimaryFocus: false },
  { ticker: "SPCX",  name: "SpaceX (Space Exploration Technologies Corp.)", weight: 1.30, sector: "Industrials", isPrimaryFocus: false },
];

// Sorted by weight descending — news prioritization uses this order
export const PORTFOLIO_BY_WEIGHT = [...PORTFOLIO_HOLDINGS].sort(
  (a, b) => b.weight - a.weight
);

// Fast ticker → holding lookup
export const PORTFOLIO_MAP = new Map<string, Holding>(
  PORTFOLIO_HOLDINGS.map((h) => [h.ticker, h])
);

// Flat list of tickers for API calls
export const ALL_TICKERS = PORTFOLIO_HOLDINGS.map((h) => h.ticker);

// Unique sectors for macro news context
export const ALL_SECTORS = [...new Set(PORTFOLIO_HOLDINGS.map((h) => h.sector))];
