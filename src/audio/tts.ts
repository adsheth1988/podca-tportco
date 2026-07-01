// OpenAI Text-to-Speech
// Model: tts-1-hd — highest quality, ~$30/1M chars (~$0.03/episode at 10k chars)
// Voice: onyx — deep, authoritative, broadcast-quality male voice
// No SSML needed — pauses driven by punctuation in the script

import fs from "fs/promises";
import path from "path";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const MODEL  = "tts-1-hd";
const VOICE  = "onyx";
const SPEED  = 0.95; // slightly under 1.0 — gives numbers room to land clearly
const MAX_CHARS = 4_000; // OpenAI hard limit is 4,096; leave headroom

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set in environment variables");
  return key;
}

function buildChunks(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function synthesizeChunk(text: string, apiKey: string): Promise<Buffer> {
  const response = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      "Authorization":  `Bearer ${apiKey}`,
      "Content-Type":   "application/json",
    },
    body: JSON.stringify({
      model:           MODEL,
      voice:           VOICE,
      input:           text,
      speed:           SPEED,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS ${response.status}: ${error}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function generateAudio(script: string): Promise<Buffer> {
  const apiKey = requireApiKey();
  const chunks = buildChunks(script, MAX_CHARS);

  console.log(`[tts] ${chunks.length} chunk(s) | ${script.length} chars | ${MODEL}/${VOICE}`);

  // Chunks run in parallel — order preserved via index
  const buffers = await Promise.all(
    chunks.map((chunk, i) => {
      console.log(`[tts] Chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      return synthesizeChunk(chunk, apiKey);
    })
  );

  return Buffer.concat(buffers);
}

export function estimateDurationSeconds(wordCount: number, wpm = 162): number {
  return Math.round((wordCount / wpm) * 60);
}

// Prepends the pre-rendered intro stinger (public/audio/intro-stinger.mp3) to
// an episode's audio. Falls back to the episode audio alone if the stinger
// hasn't been generated yet (see scripts/build-intro-stinger.ts).
export async function withIntroStinger(episodeAudio: Buffer): Promise<Buffer> {
  const introPath = path.join(process.cwd(), "public", "audio", "intro-stinger.mp3");
  try {
    const intro = await fs.readFile(introPath);
    return Buffer.concat([intro, episodeAudio]);
  } catch {
    console.warn("[tts] intro-stinger.mp3 not found — run `npm run gen:stinger`. Skipping intro.");
    return episodeAudio;
  }
}
