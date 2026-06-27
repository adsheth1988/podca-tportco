import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WATCHLIST = ["SPY", "QQQM", "SOXX", "IWM", "MEME"];

async function fetchQuote(ticker: string) {
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

    const price        = meta.regularMarketPrice as number;
    const prev         = meta.chartPreviousClose as number;
    const changePercent = ((price - prev) / prev) * 100;
    const changeDollar  = price - prev;

    return { ticker, price, changePercent, changeDollar };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function GET() {
  const results = await Promise.all(WATCHLIST.map(fetchQuote));
  return NextResponse.json({
    quotes: results.filter(Boolean),
    updatedAt: new Date().toISOString(),
  });
}
