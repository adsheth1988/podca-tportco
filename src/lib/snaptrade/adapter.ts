import "server-only";
import type { Holding } from "@/config/portfolio";
import { getSnapTradeClient } from "./client";

// Instrument kinds we treat as portfolio holdings for the podcast. Crypto,
// options, mutual funds, and CFDs are excluded — the script generator and
// news pipeline are built around equity/ETF tickers.
const EQUITY_LIKE_KINDS = new Set(["stock", "etf", "adr", "cef"]);

// Best-effort ticker -> sector lookup. SnapTrade doesn't return GICS sector
// data; a static map covers common holdings without a new API integration.
// Falls back to "Other" for anything unmapped.
const SECTOR_MAP: Record<string, string> = {
  AAPL: "Technology", MSFT: "Technology", NVDA: "Technology", GOOGL: "Communication Services",
  GOOG: "Communication Services", AMZN: "Consumer Discretionary", META: "Communication Services",
  TSLA: "Consumer Discretionary", AVGO: "Technology", AMD: "Technology", INTC: "Technology",
  MU: "Technology", COST: "Consumer Defensive", WMT: "Consumer Defensive", NFLX: "Communication Services",
};

const TOP_N_PRIMARY = 9; // mirrors the QQQ podcast's primary-holdings convention

export interface LiveHoldingsResult {
  holdings: Holding[];
  portfolioTotalValue: number;
}

export async function fetchLiveHoldings(
  snapTradeUserId: string,
  userSecret: string
): Promise<LiveHoldingsResult> {
  const client = getSnapTradeClient();

  const accountsRes = await client.accountInformation.listUserAccounts({
    userId: snapTradeUserId,
    userSecret,
  });
  const accounts = accountsRes.data;

  const portfolioTotalValue = accounts.reduce(
    (sum, acct) => sum + (acct.balance?.total?.amount ?? 0),
    0
  );

  // ticker -> aggregated market value across all accounts
  const valueByTicker = new Map<string, { name: string; value: number }>();

  for (const account of accounts) {
    const positionsRes = await client.accountInformation.getAllAccountPositions({
      userId: snapTradeUserId,
      userSecret,
      accountId: account.id,
    });

    for (const position of positionsRes.data.results) {
      const instrument = position.instrument as { kind?: string; symbol?: string; description?: string | null };
      if (!instrument.kind || !EQUITY_LIKE_KINDS.has(instrument.kind)) continue;
      if (!instrument.symbol) continue;

      const units = parseFloat(position.units ?? "0");
      const price = parseFloat(position.price ?? "0");
      const marketValue = units * price;
      if (!Number.isFinite(marketValue) || marketValue <= 0) continue;

      const existing = valueByTicker.get(instrument.symbol);
      if (existing) {
        existing.value += marketValue;
      } else {
        valueByTicker.set(instrument.symbol, {
          name: instrument.description ?? instrument.symbol,
          value: marketValue,
        });
      }
    }
  }

  const totalHoldingsValue = [...valueByTicker.values()].reduce((s, h) => s + h.value, 0);

  const holdings: Holding[] = [...valueByTicker.entries()]
    .map(([ticker, { name, value }]) => ({
      ticker,
      name,
      weight: totalHoldingsValue > 0 ? (value / totalHoldingsValue) * 100 : 0,
      sector: SECTOR_MAP[ticker] ?? "Other",
    }))
    .sort((a, b) => b.weight - a.weight)
    .map((h, i) => ({ ...h, isPrimaryFocus: i < TOP_N_PRIMARY }));

  return { holdings, portfolioTotalValue };
}
