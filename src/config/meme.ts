// MEME (Roundhill Meme Stock ETF) holdings. Unlike QQQ/SOXX, this is an
// actively-managed strategy fund that rotates its ~10-21 holdings on a
// roughly monthly basis — this list needs refreshing far more often than
// portfolio.ts/soxx.ts. Top 5 weights are well-confirmed as of July 2026
// research; the remainder are lower-confidence estimates for names
// consistently cited as current holdings but without a precisely
// confirmed weight — treat those as working estimates, same as SPCX in
// portfolio.ts, pending a confirmed figure.
import type { Holding } from "@/config/portfolio";

export const MEME_HOLDINGS: Holding[] = [
  { ticker: "AAOI", name: "Applied Optoelectronics, Inc.", weight: 7.43, sector: "Technology", isPrimaryFocus: true },
  { ticker: "RDW",  name: "Redwire Corporation",           weight: 6.97, sector: "Industrials", isPrimaryFocus: true },
  { ticker: "ASTS", name: "AST SpaceMobile, Inc.",         weight: 6.29, sector: "Communication Services", isPrimaryFocus: true },
  { ticker: "NBIS", name: "Nebius Group N.V.",             weight: 6.01, sector: "Technology", isPrimaryFocus: true },
  { ticker: "BE",   name: "Bloom Energy Corporation",      weight: 5.96, sector: "Industrials", isPrimaryFocus: true },
  { ticker: "WULF", name: "TeraWulf Inc.",                 weight: 5.50, sector: "Technology", isPrimaryFocus: true }, // estimate
  { ticker: "LITE", name: "Lumentum Holdings Inc.",        weight: 5.50, sector: "Technology", isPrimaryFocus: true }, // estimate
  { ticker: "IREN", name: "IREN Limited",                  weight: 5.00, sector: "Technology", isPrimaryFocus: true }, // estimate
  { ticker: "SNDK", name: "Sandisk Corporation",           weight: 5.00, sector: "Technology", isPrimaryFocus: true }, // estimate
];
