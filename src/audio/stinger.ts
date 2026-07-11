// Chosen intro stinger, prepended to every episode's audio.
// Rendered once to public/audio/intro-stinger.mp3 via `npm run gen:stinger`
// (see scripts/generate-intro-stingers.ts for the full candidate set that was auditioned).
// Brand-neutral: shared across both podcast identities (QQQ_PODCAST and
// PERSONAL_PODCAST in src/config/podcasts.ts), so it can't name either show.
export const INTRO_STINGER_TEXT =
  "This is The Portfolio Podcast — decoded daily.";

export const INTRO_STINGER_PATH = "public/audio/intro-stinger.mp3";
