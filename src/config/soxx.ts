// SOXX (iShares Semiconductor ETF) holdings — top 10 by weight, which is
// the fund's most concentrated tier (~60.10% of total assets across its 34
// holdings). Weights sourced from two corroborating public ETF-holdings
// aggregators, dated July 9, 2026 (top-10 sum matches the independently
// reported 60.10% total exactly). Refreshed automatically by a weekly
// scheduled Routine, same as portfolio.ts — manual edits are fine but may
// be overwritten next run.
import type { Holding } from "@/config/portfolio";

export const SOXX_HOLDINGS: Holding[] = [
  { ticker: "AMD",  name: "Advanced Micro Devices, Inc.",  weight: 8.39, sector: "Technology", isPrimaryFocus: true },
  { ticker: "MU",   name: "Micron Technology, Inc.",       weight: 8.08, sector: "Technology", isPrimaryFocus: true },
  { ticker: "NVDA", name: "NVIDIA Corporation",            weight: 7.61, sector: "Technology", isPrimaryFocus: true },
  { ticker: "AVGO", name: "Broadcom Inc.",                 weight: 7.10, sector: "Technology", isPrimaryFocus: true },
  { ticker: "INTC", name: "Intel Corporation",             weight: 5.62, sector: "Technology", isPrimaryFocus: true },
  { ticker: "AMAT", name: "Applied Materials, Inc.",       weight: 5.18, sector: "Technology", isPrimaryFocus: true },
  { ticker: "KLAC", name: "KLA Corporation",                weight: 4.73, sector: "Technology", isPrimaryFocus: true },
  { ticker: "MRVL", name: "Marvell Technology, Inc.",      weight: 4.70, sector: "Technology", isPrimaryFocus: true },
  { ticker: "LRCX", name: "Lam Research Corporation",      weight: 4.39, sector: "Technology", isPrimaryFocus: true },
  { ticker: "TSM",  name: "Taiwan Semiconductor Mfg. Co.", weight: 4.30, sector: "Technology", isPrimaryFocus: true },
];
