#!/usr/bin/env tsx
/**
 * Renders the chosen intro stinger (src/audio/stinger.ts) to a static asset
 * that gets prepended to every episode's audio. Committed to the repo since
 * it's rendered once, not regenerated per episode.
 *
 * Run: npm run gen:stinger  (requires OPENAI_API_KEY)
 */

import path from "path";
import fs from "fs/promises";
import { generateAudio } from "../src/audio/tts";
import { INTRO_STINGER_TEXT } from "../src/audio/stinger";

async function main() {
  console.log(`[stinger] Synthesizing: "${INTRO_STINGER_TEXT}"`);
  const buffer = await generateAudio(INTRO_STINGER_TEXT);

  const outPath = path.join(process.cwd(), "public", "audio", "intro-stinger.mp3");
  await fs.writeFile(outPath, buffer);
  console.log(`[stinger] Saved public/audio/intro-stinger.mp3 (${Math.round(buffer.length / 1024)}KB)`);
}

main().catch((err) => {
  console.error("[stinger] Fatal error:", err);
  process.exit(1);
});
