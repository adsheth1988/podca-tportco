import type { Holding } from "@/config/portfolio";
import type { PodcastIdentity } from "@/config/podcasts";
import { EFFECTIVE_WPM } from "@/audio/tts";
import type { AggregatedNewsResult, NewsItem } from "@/types/news";
import type { PortfolioSnapshot } from "@/lib/prices";

// ── Config ─────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// claude-sonnet-4-6: best instruction following for structured long-form output.
// Tradeoff: ~2× cost of Haiku, but script quality is the heart of the product.
// Switch to claude-haiku-4-5 if cost becomes a concern after validating.
const MODEL = "claude-sonnet-4-6";

const TARGET_MINUTES = 7;
// Derived from tts.ts's EFFECTIVE_WPM so this never drifts out of sync with
// the actual TTS speed again.
const TARGET_WORD_COUNT = Math.round(EFFECTIVE_WPM * TARGET_MINUTES);

// ── Helpers ────────────────────────────────────────────────────────────────────

function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  return key;
}

function formatArticle(article: NewsItem, index: number): string {
  const label    = article.ticker ?? "MARKET";
  const sentiment =
    article.sentimentScore !== 0
      ? ` [${article.sentimentScore > 0 ? "bullish" : "bearish"}: ${Math.abs(article.sentimentScore).toFixed(2)}]`
      : "";

  return [
    `[${index + 1}] ${label}${sentiment}`,
    `Headline: ${article.title}`,
    `Detail: ${article.description || article.snippet}`,
    `Source: ${article.source} · ${new Date(article.publishedAt).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" })} EST`,
  ].join("\n");
}

function formatPnL(snapshot: PortfolioSnapshot, identity: PodcastIdentity): string {
  const sign = snapshot.portfolioChangePercent >= 0 ? "+" : "";
  const pct  = `${sign}${snapshot.portfolioChangePercent.toFixed(2)}%`;

  if (!identity.aggregateDollarAllowed) {
    return `Portfolio: ${pct}`;
  }

  const pnlSign = snapshot.portfolioPnL >= 0 ? "+" : "-";
  const pnl     = `${pnlSign}$${Math.abs(snapshot.portfolioPnL).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const value   = `$${snapshot.portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `Portfolio: ${pct} (${pnl}) | Current value: ${value}`;
}

function formatPriceTable(snapshot: PortfolioSnapshot, holdings: Holding[], identity: PodcastIdentity): string {
  if (snapshot.prices.length === 0) return "  (price data unavailable)";
  return holdings.map(h => {
    const p = snapshot.prices.find(px => px.ticker === h.ticker);
    if (!p) return `  ${h.ticker.padEnd(5)} — price unavailable`;
    const sign = p.changePercent >= 0 ? "+" : "";
    if (!identity.perHoldingDollarAllowed) {
      return `  ${h.ticker.padEnd(5)}  ${sign}${p.changePercent.toFixed(2)}%`;
    }
    return `  ${h.ticker.padEnd(5)} $${p.price.toFixed(2).padStart(8)}  ${sign}${p.changeDollar.toFixed(2).padStart(7)}  ${sign}${p.changePercent.toFixed(2)}%`;
  }).join("\n");
}

function buildPrompt(
  news: AggregatedNewsResult,
  dateLabel: string,
  snapshot: PortfolioSnapshot,
  isWeekend: boolean,
  holdings: Holding[],
  identity: PodcastIdentity
): string {
  const dayName = dateLabel.split(",")[0]; // e.g. "Friday"

  // Weekday and weekend both reference the trading day only, no timestamp.
  const sessionContext = isWeekend
    ? `SESSION: ${dateLabel} — market close`
    : `SESSION: ${dateLabel}`;

  const dollarClause = identity.aggregateDollarAllowed
    ? `Then state the portfolio's total value and dollar P&L for the session, followed by: "The portfolio closed [X]% [up/down] on the session."`
    : `Then state exactly: "The portfolio closed [X]% [up/down] on the session." using the portfolio change percent — no dollar figures.`;

  const welcomeInstruction = isWeekend
    ? `Open with exactly: "Hello, this is ${identity.showName}. ${dayName}'s market close — here is your ${identity.recapLabel}." ${dollarClause}`
    : `Open with exactly: "Hello, this is ${identity.showName}. ${dayName} — here is your ${identity.recapLabel}." ${dollarClause}`;

  const sessionRule = isWeekend
    ? `Always reference this session as "${dayName}'s close" or "at ${dayName}'s market close." NEVER say "today," "this weekend," "Saturday," or "Sunday."`
    : `Always reference this session as "${dayName}'s session." NEVER say "today." NEVER state a specific time or "as of" timestamp.`;

  const holdingsByWeight = [...holdings].sort((a, b) => b.weight - a.weight);
  const primaryFocusHoldings = holdingsByWeight.filter(h => h.isPrimaryFocus !== false);
  const secondaryHoldings = holdingsByWeight.filter(h => h.isPrimaryFocus === false);
  const hasNews = (ticker: string) => news.portfolioArticles.some(a => a.ticker === ticker);

  const portfolioLines = primaryFocusHoldings
    .map(h => `  ${h.ticker} (${h.name}, ${h.sector}) — ${h.weight.toFixed(2)}% of portfolio`)
    .join("\n");

  const secondaryLines = secondaryHoldings
    .map(h => `  ${h.ticker} (${h.name}, ${h.sector}) — ${h.weight.toFixed(2)}% of portfolio`)
    .join("\n");

  const priceTable = formatPriceTable(snapshot, holdingsByWeight, identity);

  const tickerNewsText = news.portfolioArticles
    .slice(0, 14)
    .map(formatArticle)
    .join("\n\n");

  const macroNewsText = news.macroArticles
    .slice(0, 5)
    .map(formatArticle)
    .join("\n\n");

  const noNewsPrimaryHoldings = primaryFocusHoldings
    .filter(h => !hasNews(h.ticker))
    .map(h => h.ticker)
    .join(", ");

  // Only offer secondary holdings that actually have news as substitutes —
  // an empty-news secondary ticker is not a useful fallback.
  const secondaryWithNewsTickers = secondaryHoldings
    .filter(h => hasNews(h.ticker))
    .map(h => h.ticker)
    .join(", ");

  const portfolioPnLText = formatPnL(snapshot, identity);

  const holdingRundownOpener = identity.perHoldingDollarAllowed
    ? `MANDATORY FOR EVERY PRIMARY HOLDING — open with the session price move using exact figures from the price table above:
     Example: "Apple closed at one hundred eighty-five dollars and twenty cents, down one point four two percent on the session."`
    : `MANDATORY FOR EVERY PRIMARY HOLDING — open with the session percent move only, no dollar price, using exact figures from the price table above:
     Example: "Apple was down one point four two percent on the session."`;

  const dollarFormatRule = identity.perHoldingDollarAllowed
    ? `- Every holding in section ⑤ MUST open with its closing price and session % move — no exceptions, even for quiet sessions.
- The overall portfolio move (stated once, in the welcome) is percent-only — never state the portfolio's dollar P&L or total dollar value, anywhere in the script.`
    : `- Every holding in section ⑤ MUST open with its session % move only — no exceptions, even for quiet sessions. NEVER state a dollar price or dollar value for any individual holding, anywhere in the script — a per-holding price combined with a guessable share count can reveal that position's size.
- The portfolio's aggregate total value and dollar P&L, stated once in the welcome, is the only place a dollar figure is allowed in the entire script.`;

  return `You are the host of "${identity.showName}". You are unnamed — never state or imply a personal name for the host. Your tone is calm, authoritative, and direct. Think Bloomberg Radio: professional, data-driven, no hype.

${sessionContext}
${portfolioPnLText}

PRIMARY HOLDINGS — ${primaryFocusHoldings.length} total, covered every episode (listed largest to smallest):
${portfolioLines}

SECONDARY HOLDINGS — ${secondaryHoldings.length} total, fallback news sources only, never covered directly unless substituted in below:
${secondaryLines}

${dayName.toUpperCase()} PRICE MOVES (mandatory — use exact figures for every primary holding):
${priceTable}

PRIMARY HOLDINGS WITH NO NEWS: ${noNewsPrimaryHoldings || "none"}
SECONDARY HOLDINGS WITH NEWS (valid substitutes only): ${secondaryWithNewsTickers || "none"}

TICKER-SPECIFIC NEWS (ranked by relevance):
${tickerNewsText || "No ticker-specific news found."}

BROAD MARKET CONTEXT:
${macroNewsText || "No macro news available."}

─────────────────────────────────────────────────────────
TASK: Write a complete, ready-to-record podcast script using the structure below.
Target: exactly ${TARGET_WORD_COUNT} words total.

STRUCTURE:

① WELCOME & DATE (~50 words)
   ${welcomeInstruction}
   Keep it factual and punchy.

② COLD OPEN (~40 words)
   Drop straight into the single most important story of the session — no additional introduction.
   Hook the listener immediately. End on a hard factual statement that creates tension.

③ MARKET SNAPSHOT (~80 words)
   Two sentences maximum on macro context: what drove the broad market in the session, and one relevant macro data point (Fed, rates, jobs, etc.) if available. Include at least one index-level number (e.g. Nasdaq or S&P 500 % move). Crisp and factual.

④ TOP STORY (~160 words)
   The deepest dive of the episode. Take the most market-moving development from the holdings news and give it full context: what happened, the specific numbers, what analysts are saying, and what it means for the position in this portfolio. This should feel like a proper news segment.

⑤ HOLDINGS RUNDOWN (~800 words)
   Cover all ${primaryFocusHoldings.length} primary holdings in order of portfolio weight (largest first). Allocate airtime proportionally — heavier weights get more sentences.
   ${holdingRundownOpener}
   Then: one sentence of news context or analyst commentary (if any) → what to watch next.
   For primary holdings with no news: still state the price move, then give one brief sentence of context (sector trend, relative performance vs index, or upcoming catalyst).
   If any primary holding has no news, you may substitute it with one of the SECONDARY HOLDINGS WITH NEWS listed above, but prioritize covering the primary ${primaryFocusHoldings.length}.
   Use natural broadcast transitions ("Turning to...", "Over at...", "Meanwhile...").

⑥ NUMBERS TO WATCH (~80 words)
   Three specific, concrete data points or events coming in the next 24-48 hours that are directly relevant to this portfolio — earnings releases, Fed speakers, economic prints, product events. Give the exact name, timing, and why it matters for holders, briefly.

⑦ OUTRO (~40 words)
   Close with exactly: "This is ${identity.showName}. We will be back same time the next business day with tomorrow's news." Then add one forward-looking sentence on what to watch for.

FORMAT RULES (strictly enforced):
- Write for ears only. No bullet points, headers, markdown, or section labels in the output.
- No financial advice. Report facts and analyst commentary. Never "you should buy/sell."
- ${sessionRule}
${dollarFormatRule}
- Spell out all numbers as words when spoken (e.g. "one point four two percent", "two hundred eighty-three dollars and seventy-eight cents").
- Never state ticker symbols. Refer to every company by its full name only (e.g. "Apple", "Microsoft", "Alphabet") — never "AAPL," "A-A-P-L," or any other ticker form.
- Cite specific figures and sources when available.
- Never state, imply, or invent a personal name for the host, in any section.
- Output the spoken script only. Begin with "Hello, this is ${identity.showName}..."`;
}

// ── Main export ────────────────────────────────────────────────────────────────

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

export async function generatePodcastScript(
  news: AggregatedNewsResult,
  dateLabel: string,
  snapshot: PortfolioSnapshot,
  isWeekend: boolean,
  holdings: Holding[],
  identity: PodcastIdentity
): Promise<string> {
  const apiKey = requireApiKey();
  const prompt = buildPrompt(news, dateLabel, snapshot, isWeekend, holdings, identity);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 2_500,
      messages:   [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${error}`);
  }

  const data: AnthropicResponse = await response.json();
  const textBlock = data.content.find(b => b.type === "text");

  if (!textBlock?.text) {
    throw new Error("Claude returned no text content in response");
  }

  return textBlock.text.trim();
}

// ── Utilities used downstream ──────────────────────────────────────────────────

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Post-generation guardrail for the `personal` profile: confirms no dollar
// figure appears anywhere outside the welcome line (where the aggregate
// total is intentionally allowed). Returns true if a leak was found.
export function hasPerHoldingDollarLeak(script: string, identity: PodcastIdentity): boolean {
  if (identity.perHoldingDollarAllowed) return false;

  const paragraphs = script.split(/\n\n+/);
  // Welcome is always the first paragraph per the prompt's structure.
  const body = paragraphs.slice(1).join("\n\n");
  return /\$\s?\d|\bdollars?\b/i.test(body);
}
