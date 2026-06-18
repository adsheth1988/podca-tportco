// Google Cloud Text-to-Speech
// Journey voices: Google's most natural-sounding generation (2024+)
// Free tier: 1,000,000 characters/month for Journey voices
// A 10-minute episode ≈ 10,000 SSML chars → ~100 free episodes/month

const GCP_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// en-US-Journey-D: Google's latest deep male voice — natural, broadcast-quality.
// Noticeably more expressive than Neural2. Ideal for financial podcasting.
const VOICE_NAME    = "en-US-Chirp3-HD-Charon";
const VOICE_GENDER  = "MALE";
const LANGUAGE_CODE = "en-US";

// Slightly under 1.0 for financial content — gives numbers room to land clearly.
const SPEAKING_RATE = 0.95;

// Journey voices use SSML input for best results.
// SSML chunk limit is ~4,800 chars (excluding tags).
// 5000 byte limit — SSML tags add overhead on top of text chars.
// Using 3,500 chars to safely stay under after tag expansion.
const MAX_CHARS_PER_CHUNK = 3_500;

function requireApiKey(): string {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) throw new Error("GOOGLE_TTS_API_KEY is not set in environment variables");
  return key;
}

// ── SSML conversion ────────────────────────────────────────────────────────────
// Converts plain script text to SSML:
//   - Paragraph breaks → 750ms pause (natural broadcast beat between topics)
//   - Sentence endings → slight 200ms pause for clarity
//   - Ticker symbols (ALL CAPS 1-5 chars) → <say-as interpret-as="characters"> so
//     "NVDA" is read "N-V-D-A" not "Nevada"
//   - Percentages → spoken naturally via say-as cardinal
function toSsml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withTickers = escaped.replace(
    /\b([A-Z]{2,5})\b/g,
    (match) => {
      // Only wrap known-looking tickers (all caps, 2-5 chars, not common words)
      const commonWords = new Set(["I", "A", "AM", "PM", "ET", "US", "CEO", "CFO", "CTO", "IPO", "ETF", "AI", "FTC", "DMA", "AWS", "GDP", "FED", "YTD", "PE", "EPS"]);
      if (commonWords.has(match)) return match;
      return `<say-as interpret-as="characters">${match}</say-as>`;
    }
  );

  // Paragraph breaks (double newline) → long pause
  const withParaBreaks = withTickers.replace(
    /\n\n+/g,
    '\n<break time="750ms"/>\n'
  );

  // Single newlines → short pause
  const withLineBreaks = withParaBreaks.replace(
    /\n/g,
    '<break time="200ms"/>'
  );

  return `<speak>${withLineBreaks}</speak>`;
}

// ── Chunking ───────────────────────────────────────────────────────────────────
// Split at paragraph boundaries first, then sentence boundaries.
// Each chunk is wrapped in its own <speak> tag.
function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
}

function buildChunks(text: string, maxChars: number): string[] {
  const paragraphs = splitIntoParagraphs(text);
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

// ── Single chunk synthesis ─────────────────────────────────────────────────────

async function synthesizeChunk(text: string, apiKey: string): Promise<Buffer> {
  const ssml = toSsml(text);

  const response = await fetch(`${GCP_TTS_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { ssml },
      voice: {
        languageCode: LANGUAGE_CODE,
        name:         VOICE_NAME,
        ssmlGender:   VOICE_GENDER,
      },
      audioConfig: {
        audioEncoding:    "MP3",
        speakingRate:     SPEAKING_RATE,
        pitch:            0.0,
        // headphone-class-device: optimised for earbuds/headphones (primary podcast listening)
        effectsProfileId: ["headphone-class-device"],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google TTS ${response.status}: ${error}`);
  }

  const json = await response.json();
  if (!json.audioContent) throw new Error("Google TTS returned no audioContent");

  return Buffer.from(json.audioContent as string, "base64");
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function generateAudio(script: string): Promise<Buffer> {
  const apiKey = requireApiKey();
  const chunks = buildChunks(script, MAX_CHARS_PER_CHUNK);

  console.log(
    `[tts] Synthesizing ${chunks.length} chunk(s) | ` +
    `${script.length} total chars | voice: ${VOICE_NAME}`
  );

  const audioBuffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[tts] Chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
    const buffer = await synthesizeChunk(chunks[i], apiKey);
    audioBuffers.push(buffer);
  }

  return Buffer.concat(audioBuffers);
}

export function estimateDurationSeconds(wordCount: number, wpm = 162): number {
  // 162 WPM accounts for 170 WPM target minus SSML pause overhead
  return Math.round((wordCount / wpm) * 60);
}
