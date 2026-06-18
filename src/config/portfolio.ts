// QQQM top 10 holdings — single source of truth for the portfolio.
// Weights sourced from Invesco fact sheet (June 2026). Update quarterly.

export interface Holding {
  ticker: string;
  name: string;
  weight: number; // % allocation in QQQM (top 10 sum ~55%)
  sector: string;
}

export const PORTFOLIO_HOLDINGS: Holding[] = [
  { ticker: "AAPL",  name: "Apple Inc.",                    weight:  8.97, sector: "Technology" },
  { ticker: "MSFT",  name: "Microsoft Corporation",         weight:  8.42, sector: "Technology" },
  { ticker: "NVDA",  name: "NVIDIA Corporation",            weight:  8.15, sector: "Technology" },
  { ticker: "AMZN",  name: "Amazon.com Inc.",               weight:  5.52, sector: "Consumer Discretionary" },
  { ticker: "AVGO",  name: "Broadcom Inc.",                 weight:  4.61, sector: "Technology" },
  { ticker: "META",  name: "Meta Platforms Inc.",           weight:  4.48, sector: "Communication Services" },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A",         weight:  4.12, sector: "Communication Services" },
  { ticker: "GOOG",  name: "Alphabet Inc. Class C",         weight:  3.89, sector: "Communication Services" },
  { ticker: "TSLA",  name: "Tesla Inc.",                    weight:  3.54, sector: "Consumer Discretionary" },
  { ticker: "COST",  name: "Costco Wholesale Corporation",  weight:  2.81, sector: "Consumer Staples" },
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
