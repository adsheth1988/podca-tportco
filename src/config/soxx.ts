// SOXX (iShares Semiconductor ETF) holdings — top 10 by weight, which is
// the fund's most concentrated tier (~60% of total assets across its 34
// holdings). Weights sourced from public ETF-holdings aggregators, July
// 2026. Refreshed automatically by a weekly scheduled Routine, same as
// portfolio.ts — manual edits are fine but may be overwritten next run.
import type { Holding } from "@/config/portfolio";

export const SOXX_HOLDINGS: Holding[] = [
  { ticker: "MU",   name: "Micron Technology, Inc.",       weight: 8.54, sector: "Technology", isPrimaryFocus: true },
  { ticker: "AMD",  name: "Advanced Micro Devices, Inc.",  weight: 8.09, sector: "Technology", isPrimaryFocus: true },
  { ticker: "NVDA", name: "NVIDIA Corporation",            weight: 6.81, sector: "Technology", isPrimaryFocus: true },
  { ticker: "INTC", name: "Intel Corporation",             weight: 6.33, sector: "Technology", isPrimaryFocus: true },
  { ticker: "AVGO", name: "Broadcom Inc.",                 weight: 6.08, sector: "Technology", isPrimaryFocus: true },
  { ticker: "AMAT", name: "Applied Materials, Inc.",       weight: 5.77, sector: "Technology", isPrimaryFocus: true },
  { ticker: "KLAC", name: "KLA Corporation",                weight: 5.64, sector: "Technology", isPrimaryFocus: true },
  { ticker: "LRCX", name: "Lam Research Corporation",      weight: 4.89, sector: "Technology", isPrimaryFocus: true },
  { ticker: "MRVL", name: "Marvell Technology, Inc.",      weight: 4.88, sector: "Technology", isPrimaryFocus: true },
  { ticker: "TSM",  name: "Taiwan Semiconductor Mfg. Co.", weight: 4.26, sector: "Technology", isPrimaryFocus: true },
];
