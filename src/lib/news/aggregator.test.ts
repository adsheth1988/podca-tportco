import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isBlocked,
  recencyMultiplier,
  computeRankScore,
  deduplicateByUrl,
  groupArticlesByTicker,
  selectArticlesForScript,
} from "./aggregator";
import type { NewsItem } from "@/types/news";

describe("isBlocked", () => {
  it("blocks an exact blocked domain", () => {
    expect(isBlocked("zacks.com")).toBe(true);
  });

  it("blocks case-insensitively", () => {
    expect(isBlocked("Zacks.COM")).toBe(true);
  });

  it("blocks a subdomain/substring match", () => {
    expect(isBlocked("www.zacks.com")).toBe(true);
    expect(isBlocked("finance.zacks.com")).toBe(true);
  });

  it("blocks substack.com", () => {
    expect(isBlocked("someauthor.substack.com")).toBe(true);
  });

  it("does not block an unrelated source", () => {
    expect(isBlocked("reuters.com")).toBe(false);
  });
});

describe("recencyMultiplier", () => {
  const NOW = new Date("2026-07-11T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function agoHours(hours: number): string {
    return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
  }

  it("is 1.00 for articles under 4 hours old", () => {
    expect(recencyMultiplier(agoHours(0))).toBe(1.0);
    expect(recencyMultiplier(agoHours(3.9))).toBe(1.0);
  });

  it("is 0.90 for articles between 4 and 8 hours old", () => {
    expect(recencyMultiplier(agoHours(4))).toBe(0.9);
    expect(recencyMultiplier(agoHours(7.9))).toBe(0.9);
  });

  it("is 0.80 for articles between 8 and 12 hours old", () => {
    expect(recencyMultiplier(agoHours(8))).toBe(0.8);
    expect(recencyMultiplier(agoHours(11.9))).toBe(0.8);
  });

  it("is 0.65 for articles between 12 and 18 hours old", () => {
    expect(recencyMultiplier(agoHours(12))).toBe(0.65);
    expect(recencyMultiplier(agoHours(17.9))).toBe(0.65);
  });

  it("is 0.50 for articles between 18 and 24 hours old", () => {
    expect(recencyMultiplier(agoHours(18))).toBe(0.5);
    expect(recencyMultiplier(agoHours(23.9))).toBe(0.5);
  });

  it("is 0.30 for articles 24 hours or older", () => {
    expect(recencyMultiplier(agoHours(24))).toBe(0.3);
    expect(recencyMultiplier(agoHours(100))).toBe(0.3);
  });
});

describe("computeRankScore", () => {
  const NOW = new Date("2026-07-11T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("combines weight, recency, and sentiment bonus", () => {
    const publishedAt = NOW.toISOString(); // ageHours = 0 -> recency 1.00
    // weight 10, sentiment 0.5 -> bonus = 1 + 0.5*0.25 = 1.125
    expect(computeRankScore(10, 0.5, publishedAt)).toBeCloseTo(10 * 1.0 * 1.125, 6);
  });

  it("uses the absolute value of sentiment for the bonus", () => {
    const publishedAt = NOW.toISOString();
    expect(computeRankScore(10, -0.5, publishedAt)).toBeCloseTo(
      computeRankScore(10, 0.5, publishedAt),
      6
    );
  });

  it("is zero when weight is zero regardless of sentiment/recency", () => {
    const publishedAt = NOW.toISOString();
    expect(computeRankScore(0, 1, publishedAt)).toBe(0);
  });
});

describe("deduplicateByUrl", () => {
  it("removes exact duplicate URLs, keeping the first occurrence", () => {
    const items = [
      { url: "https://example.com/a", tag: "first" },
      { url: "https://example.com/a", tag: "second" },
    ];
    const result = deduplicateByUrl(items);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("first");
  });

  it("treats differing query strings as the same article", () => {
    const items = [
      { url: "https://example.com/a?utm_source=x" },
      { url: "https://example.com/a?utm_source=y" },
    ];
    expect(deduplicateByUrl(items)).toHaveLength(1);
  });

  it("is case-insensitive on the host/path", () => {
    const items = [
      { url: "https://Example.com/A" },
      { url: "https://example.com/a" },
    ];
    expect(deduplicateByUrl(items)).toHaveLength(1);
  });

  it("keeps distinct URLs", () => {
    const items = [{ url: "https://example.com/a" }, { url: "https://example.com/b" }];
    expect(deduplicateByUrl(items)).toHaveLength(2);
  });
});

function makeNewsItem(overrides: Partial<NewsItem>): NewsItem {
  return {
    id: "id",
    ticker: null,
    company: null,
    portfolioWeight: 0,
    title: "title",
    description: "desc",
    snippet: "snippet",
    url: "https://example.com/x",
    source: "reuters.com",
    publishedAt: new Date().toISOString(),
    sentimentScore: 0,
    rankScore: 0,
    isMacro: false,
    ...overrides,
  };
}

describe("groupArticlesByTicker", () => {
  it("groups articles under their ticker", () => {
    const articles = [
      makeNewsItem({ id: "1", ticker: "AAPL" }),
      makeNewsItem({ id: "2", ticker: "AAPL" }),
      makeNewsItem({ id: "3", ticker: "MSFT" }),
    ];
    const grouped = groupArticlesByTicker(articles);
    expect(grouped.get("AAPL")).toHaveLength(2);
    expect(grouped.get("MSFT")).toHaveLength(1);
  });

  it("skips articles with a null ticker", () => {
    const articles = [makeNewsItem({ id: "1", ticker: null })];
    const grouped = groupArticlesByTicker(articles);
    expect(grouped.size).toBe(0);
  });
});

describe("selectArticlesForScript", () => {
  it("respects default limits of 12 portfolio and 4 macro articles", () => {
    const portfolio = Array.from({ length: 20 }, (_, i) => makeNewsItem({ id: `p${i}` }));
    const macro = Array.from({ length: 10 }, (_, i) => makeNewsItem({ id: `m${i}` }));
    const result = selectArticlesForScript(portfolio, macro);
    expect(result.portfolio).toHaveLength(12);
    expect(result.macro).toHaveLength(4);
  });

  it("respects custom limits", () => {
    const portfolio = Array.from({ length: 5 }, (_, i) => makeNewsItem({ id: `p${i}` }));
    const macro = Array.from({ length: 5 }, (_, i) => makeNewsItem({ id: `m${i}` }));
    const result = selectArticlesForScript(portfolio, macro, { maxPortfolio: 2, maxMacro: 1 });
    expect(result.portfolio).toHaveLength(2);
    expect(result.macro).toHaveLength(1);
  });

  it("doesn't pad when there are fewer articles than the limit", () => {
    const portfolio = [makeNewsItem({ id: "p0" })];
    const result = selectArticlesForScript(portfolio, []);
    expect(result.portfolio).toHaveLength(1);
    expect(result.macro).toHaveLength(0);
  });
});
