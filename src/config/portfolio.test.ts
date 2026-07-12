import { describe, it, expect } from "vitest";
import {
  PORTFOLIO_HOLDINGS,
  PORTFOLIO_BY_WEIGHT,
  PORTFOLIO_MAP,
  ALL_TICKERS,
  ALL_SECTORS,
} from "./portfolio";

describe("PORTFOLIO_HOLDINGS invariants", () => {
  it("has no duplicate tickers", () => {
    const tickers = PORTFOLIO_HOLDINGS.map((h) => h.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
  });

  it("has a positive weight for every holding", () => {
    for (const h of PORTFOLIO_HOLDINGS) {
      expect(h.weight).toBeGreaterThan(0);
    }
  });

  it("has a non-empty name and sector for every holding", () => {
    for (const h of PORTFOLIO_HOLDINGS) {
      expect(h.name.length).toBeGreaterThan(0);
      expect(h.sector.length).toBeGreaterThan(0);
    }
  });

  it("has exactly 9 primary-focus holdings (top 9 convention)", () => {
    const primaryCount = PORTFOLIO_HOLDINGS.filter((h) => h.isPrimaryFocus !== false).length;
    expect(primaryCount).toBe(9);
  });
});

describe("PORTFOLIO_BY_WEIGHT", () => {
  it("is sorted by weight descending", () => {
    for (let i = 1; i < PORTFOLIO_BY_WEIGHT.length; i++) {
      expect(PORTFOLIO_BY_WEIGHT[i - 1].weight).toBeGreaterThanOrEqual(PORTFOLIO_BY_WEIGHT[i].weight);
    }
  });

  it("contains the same holdings as PORTFOLIO_HOLDINGS", () => {
    expect(PORTFOLIO_BY_WEIGHT).toHaveLength(PORTFOLIO_HOLDINGS.length);
    const byWeightTickers = new Set(PORTFOLIO_BY_WEIGHT.map((h) => h.ticker));
    const holdingsTickers = new Set(PORTFOLIO_HOLDINGS.map((h) => h.ticker));
    expect(byWeightTickers).toEqual(holdingsTickers);
  });
});

describe("PORTFOLIO_MAP", () => {
  it("maps every ticker to its holding", () => {
    expect(PORTFOLIO_MAP.size).toBe(PORTFOLIO_HOLDINGS.length);
    for (const h of PORTFOLIO_HOLDINGS) {
      expect(PORTFOLIO_MAP.get(h.ticker)).toEqual(h);
    }
  });
});

describe("ALL_TICKERS", () => {
  it("matches the holdings list one-to-one", () => {
    expect(ALL_TICKERS).toEqual(PORTFOLIO_HOLDINGS.map((h) => h.ticker));
  });
});

describe("ALL_SECTORS", () => {
  it("has no duplicate sectors", () => {
    expect(new Set(ALL_SECTORS).size).toBe(ALL_SECTORS.length);
  });

  it("covers every sector present in the holdings", () => {
    const sectorsFromHoldings = new Set(PORTFOLIO_HOLDINGS.map((h) => h.sector));
    expect(new Set(ALL_SECTORS)).toEqual(sectorsFromHoldings);
  });
});
