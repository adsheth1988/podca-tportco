#!/usr/bin/env tsx
/**
 * Renders a handful of candidate spoken intro stingers with the existing
 * OpenAI TTS voice so they can be auditioned before wiring one into the
 * main episode pipeline.
 *
 * Output: public/audio/stingers/{id}.mp3
 * Run: npm run gen:stingers  (requires OPENAI_API_KEY)
 */

import path from "path";
import fs from "fs/promises";
import { generateAudio } from "../src/audio/tts";

const STINGERS: { id: string; text: string }[] = [
  { id: "classic", text: "The Portfolio Podcast." },
  { id: "tagline", text: "This is The Portfolio Podcast — Q-Q-Q-M, decoded daily." },
  { id: "punchy",  text: "The Portfolio Podcast. Markets, decoded." },
  { id: "formal",  text: "You are listening to The Portfolio Podcast, your daily Q-Q-Q-M briefing." },
  { id: "close",   text: "The Portfolio Podcast — ten holdings, ten minutes, every trading day." },
];

async function main() {
  const outDir = path.join(process.cwd(), "public", "audio", "stingers");
  await fs.mkdir(outDir, { recursive: true });

  for (const stinger of STINGERS) {
    console.log(`[stingers] Synthesizing "${stinger.id}"…`);
    const buffer = await generateAudio(stinger.text);
    await fs.writeFile(path.join(outDir, `${stinger.id}.mp3`), buffer);
    console.log(`[stingers] Saved public/audio/stingers/${stinger.id}.mp3`);
  }

  console.log(`[stingers] Done — ${STINGERS.length} stinger(s) generated.`);
}

main().catch((err) => {
  console.error("[stingers] Fatal error:", err);
  process.exit(1);
});
