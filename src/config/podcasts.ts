// Identity/disclosure profile for each podcast the generator can produce.
// See src/script/generator.ts for how these flags are consumed.
export interface PodcastIdentity {
  id: string;
  showName: string;            // e.g. "The Portfolio Podcast for QQQ"
  recapLabel: string;          // e.g. "QQQ recap" — spoken right after showName
  // Aggregate portfolio total dollar value/P&L stated in the welcome line.
  aggregateDollarAllowed: boolean;
  // Per-holding exact dollar price/value in the holdings rundown. A per-
  // holding price combined with a guessable share count reveals an
  // individual position's size — keep this false for real personal holdings.
  perHoldingDollarAllowed: boolean;
}

export const QQQ_PODCAST: PodcastIdentity = {
  id: "qqq",
  showName: "The Portfolio Podcast for QQQ",
  recapLabel: "QQQ recap",
  aggregateDollarAllowed: false,
  perHoldingDollarAllowed: true,
};

export const PERSONAL_PODCAST: PodcastIdentity = {
  id: "personal",
  showName: "Your Portfolio Podcast",
  recapLabel: "portfolio recap",
  aggregateDollarAllowed: true,
  perHoldingDollarAllowed: false,
};
