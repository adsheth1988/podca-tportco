// Top holdings per ETF — update quarterly from fund fact sheets.
// Sources: Invesco (QQQ), iShares (SOXX), Roundhill (MEME)
// QQQ holdings are derived from config/portfolio.ts (the podcast's own source
// of truth) rather than duplicated here, so the sidebar can't drift out of
// sync with what the podcast actually covers.

import { PORTFOLIO_BY_WEIGHT } from "./portfolio";

export interface ETFHolding {
  ticker: string;
  name: string;
  weight: number;
}

export interface ETFInfo {
  fullName: string;
  holdings: ETFHolding[];
}

export const ETF_HOLDINGS: Record<string, ETFInfo> = {
  QQQ: {
    fullName: "Invesco QQQ Trust",
    holdings: PORTFOLIO_BY_WEIGHT.slice(0, 10).map(h => ({
      ticker: h.ticker,
      name:   h.name,
      weight: h.weight,
    })),
  },
  SOXX: {
    fullName: "iShares Semiconductor ETF",
    holdings: [
      { ticker: "NVDA",  name: "NVIDIA Corp.",          weight: 9.42 },
      { ticker: "AVGO",  name: "Broadcom Inc.",         weight: 9.18 },
      { ticker: "AMD",   name: "Advanced Micro Devices",weight: 5.82 },
      { ticker: "QCOM",  name: "Qualcomm Inc.",         weight: 5.12 },
      { ticker: "AMAT",  name: "Applied Materials",     weight: 4.85 },
      { ticker: "MU",    name: "Micron Technology",     weight: 4.52 },
      { ticker: "LRCX",  name: "Lam Research Corp.",   weight: 4.31 },
      { ticker: "KLAC",  name: "KLA Corp.",             weight: 4.18 },
      { ticker: "MRVL",  name: "Marvell Technology",   weight: 3.95 },
      { ticker: "TXN",   name: "Texas Instruments",     weight: 3.42 },
    ],
  },
  MEME: {
    fullName: "Roundhill Meme ETF",
    holdings: [
      { ticker: "GME",   name: "GameStop Corp.",        weight: 5.82 },
      { ticker: "TSLA",  name: "Tesla Inc.",            weight: 5.21 },
      { ticker: "AMC",   name: "AMC Entertainment",     weight: 4.95 },
      { ticker: "PLTR",  name: "Palantir Technologies", weight: 4.74 },
      { ticker: "RIVN",  name: "Rivian Automotive",     weight: 4.51 },
      { ticker: "SOFI",  name: "SoFi Technologies",     weight: 4.22 },
      { ticker: "HOOD",  name: "Robinhood Markets",     weight: 4.05 },
      { ticker: "RBLX",  name: "Roblox Corp.",          weight: 3.82 },
      { ticker: "LCID",  name: "Lucid Group Inc.",      weight: 3.54 },
      { ticker: "BBAI",  name: "BigBear.ai Holdings",   weight: 3.31 },
    ],
  },
};
