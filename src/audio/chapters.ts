// Chapter marker generation + embedding for episode MP3s.
//
// Approach (see PR "Add episode chapters"): chapter *times* are estimated by
// mapping each paragraph's share of the word count onto the measured audio
// duration, offset by the intro stinger. This is accurate to a few seconds —
// good enough for show-notes navigation — and requires no change to the
// script or the audio itself (chapters are pure ID3 metadata).
//
// Structure detected:
//   • the 4 fixed intro sections (Welcome / Cold open / Market snapshot /
//     Top story) by paragraph position — the prompt template always emits
//     them in that order,
//   • one chapter per primary holding, detected by the holding's spoken name
//     appearing alongside a "percent" move in the paragraph's opening,
//   • "Numbers to watch" and "Outro" by their opening phrasing.
import NodeID3 from "node-id3";
import type { Holding } from "@/config/portfolio";
import type { EpisodeChapter } from "@/types/episode";

export type { EpisodeChapter };

const INTRO_LABELS = ["Welcome", "Cold open", "Market snapshot", "Top story"];

// Turn a legal company name into the short form the host actually speaks,
// e.g. "NVIDIA Corporation" → "NVIDIA", "Amazon.com, Inc." → "Amazon",
// "Alphabet Inc. (Google)" → "Alphabet". Matched case-insensitively later.
export function deriveSpokenName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, "")                                  // drop parentheticals
    .replace(/,?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.?|Ltd\.?|Limited|plc|N\.V\.|S\.A\.|AG|LLC)$/i, "")
    .replace(/\.com\b/i, "")
    .trim();
}

function firstSentences(paragraph: string, n = 2): string {
  return paragraph.split(/(?<=[.?!])\s+/).slice(0, n).join(" ");
}

function detectHolding(head: string, names: string[]): string | null {
  if (!/percent/i.test(head)) return null; // rundown lines always state a % move
  let best: string | null = null;
  let bestPos = Infinity;
  const lower = head.toLowerCase();
  for (const nm of names) {
    const i = lower.indexOf(nm.toLowerCase());
    if (i !== -1 && i < bestPos) {
      bestPos = i;
      best = nm;
    }
  }
  return best;
}

/**
 * Build the chapter list for an episode.
 * @param script         the full spoken script
 * @param holdings       the podcast's holdings (primary ones become chapters)
 * @param totalMs        measured duration of the final audio (incl. stinger)
 * @param stingerMs      duration of the intro stinger prepended to the audio
 */
export function buildChapters(
  script: string,
  holdings: Holding[],
  totalMs: number,
  stingerMs: number
): EpisodeChapter[] {
  const names = holdings
    .filter((h) => h.isPrimaryFocus !== false)
    .map((h) => deriveSpokenName(h.name));

  const paras = script.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const words = paras.map((p) => p.split(/\s+/).filter(Boolean).length);
  const totalWords = words.reduce((a, b) => a + b, 0) || 1;

  // Spoken content runs from stingerMs to totalMs; map cumulative words into it.
  const spokenMs = Math.max(0, totalMs - stingerMs);
  const starts: number[] = [];
  let cum = 0;
  for (const w of words) {
    starts.push(stingerMs + Math.round((spokenMs * cum) / totalWords));
    cum += w;
  }

  const chapters: EpisodeChapter[] = [];
  const used = new Set<string>();
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const startMs = i === 0 ? 0 : starts[i]; // first chapter covers the stinger
    let title: string | null = null;

    if (i < INTRO_LABELS.length) {
      title = INTRO_LABELS[i];
    } else if (/^(One|Two|Three|Four|Five|Several)\b/.test(p) && /watch|track|data points|forty-eight/i.test(p.slice(0, 90))) {
      title = "Numbers to watch";
    } else if (p.startsWith("This is ")) {
      title = "Outro";
    } else {
      const h = detectHolding(firstSentences(p), names);
      if (h && !used.has(h)) {
        used.add(h);
        title = h;
      }
      // else: unlabeled paragraph — fold into the previous chapter
    }

    if (title) chapters.push({ startMs, title });
  }

  return chapters;
}

/**
 * Embed the chapter list into an MP3 buffer as ID3 CHAP + CTOC frames.
 * Returns a new buffer; the audio stream itself is untouched.
 */
export function embedChapters(audio: Buffer, chapters: EpisodeChapter[], totalMs: number): Buffer {
  if (chapters.length === 0) return audio;

  const chapterFrames = chapters.map((c, i) => ({
    elementID: `ch${i}`,
    startTimeMs: c.startMs,
    endTimeMs: i + 1 < chapters.length ? chapters[i + 1].startMs : totalMs,
    tags: { title: c.title },
  }));

  const tags = {
    chapter: chapterFrames,
    tableOfContents: [
      {
        elementID: "toc",
        isOrdered: true,
        elements: chapterFrames.map((c) => c.elementID),
        tags: { title: "Chapters" },
      },
    ],
  };

  return NodeID3.write(tags, audio) as Buffer;
}
