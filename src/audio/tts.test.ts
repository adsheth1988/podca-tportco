import { describe, it, expect } from "vitest";
import { buildChunks, estimateDurationSeconds, EFFECTIVE_WPM } from "./tts";

describe("EFFECTIVE_WPM", () => {
  it("is pinned to round(170.5 * 1.05) = 179", () => {
    // Pinned deliberately: a future speed/wpm tweak should be a visible test change.
    expect(EFFECTIVE_WPM).toBe(179);
  });
});

describe("buildChunks", () => {
  it("packs multiple short paragraphs into a single chunk", () => {
    const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
    const chunks = buildChunks(text, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("Paragraph one.\n\nParagraph two.\n\nParagraph three.");
  });

  it("splits into a new chunk once maxChars would be exceeded", () => {
    const text = "aaaaaaaaaa\n\nbbbbbbbbbb\n\ncccccccccc";
    const chunks = buildChunks(text, 15);
    expect(chunks).toEqual(["aaaaaaaaaa", "bbbbbbbbbb", "cccccccccc"]);
  });

  it("never splits a single paragraph mid-way even if it exceeds maxChars", () => {
    const longParagraph = "x".repeat(50);
    const chunks = buildChunks(longParagraph, 10);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(longParagraph);
  });

  it("still emits the full content when an over-limit paragraph follows a normal one", () => {
    const longParagraph = "y".repeat(50);
    const text = `short\n\n${longParagraph}`;
    const chunks = buildChunks(text, 10);
    expect(chunks).toEqual(["short", longParagraph]);
  });

  it("returns an empty array for empty input", () => {
    expect(buildChunks("", 100)).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(buildChunks("   \n\n  \n\n  ", 100)).toEqual([]);
  });

  it("trims whitespace around each paragraph", () => {
    const chunks = buildChunks("  hello  \n\n  world  ", 1000);
    expect(chunks).toEqual(["hello\n\nworld"]);
  });
});

describe("estimateDurationSeconds", () => {
  it("computes duration at the default EFFECTIVE_WPM", () => {
    // 179 wpm -> 179 words takes 60 seconds
    expect(estimateDurationSeconds(179)).toBe(60);
  });

  it("computes duration at a custom wpm", () => {
    expect(estimateDurationSeconds(100, 100)).toBe(60);
  });

  it("rounds to the nearest second", () => {
    expect(estimateDurationSeconds(1, 60)).toBe(1);
  });
});
