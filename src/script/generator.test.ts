import { describe, it, expect } from "vitest";
import { countWords, hasPerHoldingDollarLeak } from "./generator";
import type { PodcastIdentity } from "@/config/podcasts";

const QQQ_LIKE: PodcastIdentity = {
  id: "qqq",
  showName: "The Portfolio Podcast for QQQ",
  recapLabel: "QQQM recap",
  aggregateDollarAllowed: false,
  perHoldingDollarAllowed: true,
};

const PERSONAL_LIKE: PodcastIdentity = {
  id: "personal",
  showName: "Your Portfolio Podcast",
  recapLabel: "portfolio recap",
  aggregateDollarAllowed: true,
  perHoldingDollarAllowed: false,
};

describe("countWords", () => {
  it("counts words in a normal sentence", () => {
    expect(countWords("Hello, this is a test script.")).toBe(6);
  });

  it("collapses repeated whitespace", () => {
    expect(countWords("one    two\n\nthree")).toBe(3);
  });

  it("returns 0 for an empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace-only input", () => {
    expect(countWords("   \n\t  ")).toBe(0);
  });
});

describe("hasPerHoldingDollarLeak", () => {
  it("always returns false when perHoldingDollarAllowed is true, regardless of content", () => {
    const script = "Welcome.\n\nApple closed at one hundred eighty-five dollars.";
    expect(hasPerHoldingDollarLeak(script, QQQ_LIKE)).toBe(false);
  });

  it("ignores dollar figures that appear only in the welcome paragraph", () => {
    const script =
      "Hello, this is Your Portfolio Podcast. The portfolio closed up two percent, at four hundred thousand dollars.\n\n" +
      "Turning to Apple, shares were up one point five percent on the session.";
    expect(hasPerHoldingDollarLeak(script, PERSONAL_LIKE)).toBe(false);
  });

  it("detects a $ figure in the body", () => {
    const script =
      "Welcome paragraph, no dollar figures here.\n\n" +
      "Apple closed at $185.20, up one point four two percent.";
    expect(hasPerHoldingDollarLeak(script, PERSONAL_LIKE)).toBe(true);
  });

  it("detects the word 'dollars' in the body", () => {
    const script =
      "Welcome paragraph.\n\n" +
      "Apple closed up, adding several dollars to its share price.";
    expect(hasPerHoldingDollarLeak(script, PERSONAL_LIKE)).toBe(true);
  });

  it("has a known conservative false positive on 'dollar-cost averaging'", () => {
    const script =
      "Welcome paragraph.\n\n" +
      "Analysts recommend dollar-cost averaging into this position over time.";
    // Documents current behavior: the regex can't distinguish this phrase
    // from an actual dollar-figure leak, so it's flagged too.
    expect(hasPerHoldingDollarLeak(script, PERSONAL_LIKE)).toBe(true);
  });

  it("returns false when the body has no dollar figures at all", () => {
    const script =
      "Welcome paragraph with a total value.\n\n" +
      "Apple was up one point four two percent on the session.\n\n" +
      "Microsoft was down zero point five percent.";
    expect(hasPerHoldingDollarLeak(script, PERSONAL_LIKE)).toBe(false);
  });
});
