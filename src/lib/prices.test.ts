import { describe, it, expect } from "vitest";
import { computeWeightedSnapshot } from "./prices";
import type { Holding } from "@/config/portfolio";
import type { TickerPrice } from "./prices";

function price(ticker: string, changePercent: number): TickerPrice {
  return {
    ticker,
    price: 100,
    previousClose: 100 / (1 + changePercent / 100),
    changePercent,
    changeDollar: 0,
  };
}

function holding(ticker: string, weight: number, isPrimaryFocus?: boolean): Holding {
  return { ticker, name: ticker, weight, sector: "Technology", isPrimaryFocus };
}

describe("computeWeightedSnapshot", () => {
  it("weights already summing to 100 need no normalization", () => {
    const holdings = [holding("AAPL", 60), holding("MSFT", 40)];
    const prices = [price("AAPL", 10), price("MSFT", -10)];
    const result = computeWeightedSnapshot(holdings, prices, 100_000);
    // 10*0.6 + -10*0.4 = 6 - 4 = 2
    expect(result.portfolioChangePercent).toBeCloseTo(2, 6);
    expect(result.portfolioPnL).toBeCloseTo(2_000, 6);
    expect(result.portfolioValue).toBeCloseTo(102_000, 6);
  });

  it("normalizes weights that don't sum to 100", () => {
    const holdings = [holding("A", 7.6), holding("B", 6.8)];
    const prices = [price("A", 10), price("B", 0)];
    const result = computeWeightedSnapshot(holdings, prices, 100_000);
    const total = 7.6 + 6.8;
    const expectedChange = 10 * (7.6 / total) + 0 * (6.8 / total);
    expect(result.portfolioChangePercent).toBeCloseTo(expectedChange, 6);
  });

  it("excludes isPrimaryFocus: false holdings even when a price is present", () => {
    const holdings = [holding("PRIMARY", 50, true), holding("SECONDARY", 50, false)];
    const prices = [price("PRIMARY", 10), price("SECONDARY", 1000)];
    const result = computeWeightedSnapshot(holdings, prices, 100_000);
    // Only PRIMARY counts, and it's the only primary holding so it gets 100% weight
    expect(result.portfolioChangePercent).toBeCloseTo(10, 6);
  });

  it("treats a missing price for a primary holding as contributing zero", () => {
    const holdings = [holding("HASPRICE", 50), holding("NOPRICE", 50)];
    const prices = [price("HASPRICE", 10)]; // NOPRICE has no matching price
    const result = computeWeightedSnapshot(holdings, prices, 100_000);
    // NOPRICE contributes 0, HASPRICE contributes 10 * 0.5 = 5
    expect(result.portfolioChangePercent).toBeCloseTo(5, 6);
  });

  it("does not throw or produce NaN when holdings is empty", () => {
    const result = computeWeightedSnapshot([], [], 100_000);
    expect(result.portfolioChangePercent).toBe(0);
    expect(Number.isNaN(result.portfolioChangePercent)).toBe(false);
    expect(result.portfolioPnL).toBe(0);
    expect(result.portfolioValue).toBe(100_000);
  });

  it("treats undefined isPrimaryFocus as primary", () => {
    const holdings = [holding("A", 100, undefined)];
    const prices = [price("A", 5)];
    const result = computeWeightedSnapshot(holdings, prices, 100_000);
    expect(result.portfolioChangePercent).toBeCloseTo(5, 6);
  });

  it("passes prices through unchanged on the returned snapshot", () => {
    const holdings = [holding("A", 100)];
    const prices = [price("A", 5)];
    const result = computeWeightedSnapshot(holdings, prices, 100_000);
    expect(result.prices).toBe(prices);
  });
});
