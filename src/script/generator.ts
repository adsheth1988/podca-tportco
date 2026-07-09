import { PORTFOLIO_BY_WEIGHT } from "@/config/portfolio";
import type { AggregatedNewsResult, NewsItem } from "@/types/news";
import type { PortfolioSnapshot } from "@/lib/prices";

// ── Config ─────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// claude-sonnet-4-6: best instruction following for structured long-form output.
// Tradeoff: ~2× cost of Haiku, but script quality is the heart of the product.
// Switch to claude-haiku-4-5 if cost becomes a concern after validating.
const MODEL = "claude-sonnet-4-6";

// 1,250 words ÷ 179 WPM (current TTS speed) ≈ 7 minutes
const TARGET_WORD_COUNT = 1_250;

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

function formatPnL(snapshot: PortfolioSnapshot): string {
  const sign     = snapshot.portfolioChangePercent >= 0 ? "+" : "";
  const pnlSign  = snapshot.portfolioPnL >= 0 ? "+" : "-";
  const pct      = `${sign}${snapshot.portfolioChangePercent.toFixed(2)}%`;
  const pnl      = `${pnlSign}$${Math.abs(snapshot.portfolioPnL).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const value    = `$${snapshot.portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `Portfolio: ${pct} (${pnl}) | Current value: ${value} | Base: $100,000`;
}

function formatPriceTable(snapshot: PortfolioSnapshot): string {
  if (snapshot.prices.length === 0) return "  (price data unavailable)";
  return PORTFOLIO_BY_WEIGHT.map(h => {
    const p = snapshot.prices.find(px => px.ticker === h.ticker);
    if (!p) return `  ${h.ticker.padEnd(5)} — price unavailable`;
    const sign = p.changePercent >= 0 ? "+" : "";
    return `  ${h.ticker.padEnd(5)} $${p.price.toFixed(2).padStart(8)}  ${sign}${p.changeDollar.toFixed(2).padStart(7)}  ${sign}${p.changePercent.toFixed(2)}%`;
  }).join("\n");
}

function buildPrompt(news: AggregatedNewsResult, dateLabel: string, snapshot: PortfolioSnapshot, isWeekend: boolean): string {
  const dayName = dateLabel.split(",")[0]; // e.g. "Friday"

  // Weekday and weekend both reference the trading day only, no timestamp.
  const sessionContext = isWeekend
    ? `SESSION: ${dateLabel} — market close`
    : `SESSION: ${dateLabel}`;

  const welcomeInstruction = isWeekend
    ? `Open with exactly: "Hello, this is The Portfolio Podcast for QQQ. ${dayName}'s market close — here is your QQQM recap." Then state exactly: "The QQQ portfolio closed [X]% [up/down] on the session." using the portfolio change percent — no dollar figures.`
    : `Open with exactly: "Hello, this is The Portfolio Podcast for QQQ. ${dayName} — here is your QQQM recap." Then state exactly: "The QQQ portfolio closed [X]% [up/down] on the session." using the portfolio change percent — no dollar figures.`;

  const sessionRule = isWeekend
    ? `Always reference this session as "${dayName}'s close" or "at ${dayName}'s market close." NEVER say "today," "this weekend," "Saturday," or "Sunday."`
    : `Always reference this session as "${dayName}'s session." NEVER say "today." NEVER state a specific time or "as of" timestamp.`;

  const primaryFocusHoldings = PORTFOLIO_BY_WEIGHT.filter(h => h.isPrimaryFocus !== false);
  const secondaryHoldings = PORTFOLIO_BY_WEIGHT.filter(h => h.isPrimaryFocus === false);

  const portfolioLines = PORTFOLIO_BY_WEIGHT
    .map(h => `  ${h.ticker} (${h.name}, ${h.sector}) — ${h.weight}% of portfolio${h.isPrimaryFocus === false ? " [secondary]" : ""}`)
    .join("\n");

  const priceTable = formatPriceTable(snapshot);

  const tickerNewsText = news.portfolioArticles
    .slice(0, 14)
    .map(formatArticle)
    .join("\n\n");

  const macroNewsText = news.macroArticles
    .slice(0, 5)
    .map(formatArticle)
    .join("\n\n");

  const noNewsPrimaryHoldings = primaryFocusHoldings
    .filter(h => !news.portfolioArticles.some(a => a.ticker === h.ticker))
    .map(h => h.ticker)
    .join(", ");

  const noNewsAllHoldings = PORTFOLIO_BY_WEIGHT
    .filter(h => !news.portfolioArticles.some(a => a.ticker === h.ticker))
    .map(h => h.ticker)
    .join(", ");

  const portfolioPnLText = formatPnL(snapshot);

  return `You are the host of "The Portfolio Podcast for QQQ". You are unnamed — never state or imply a personal name for the host. Your tone is calm, authoritative, and direct. Think Bloomberg Radio: professional, data-driven, no hype.

${sessionContext}
${portfolioPnLText}

QQQM TOP 10 HOLDINGS (listed largest to smallest — prioritize coverage by weight):
${portfolioLines}

${dayName.toUpperCase()} PRICE MOVES (mandatory — use exact figures for every holding):
  TICKER  CLOSE PRICE   $ CHANGE   % CHANGE
${priceTable}

PRIMARY HOLDINGS WITH NO NEWS: ${noNewsPrimaryHoldings || "none"}
SECONDARY HOLDINGS AVAILABLE: ${secondaryHoldings.map(h => h.ticker).join(", ")}

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
   The deepest dive of the episode. Take the most market-moving development from the holdings news and give it full context: what happened, the specific numbers, what analysts are saying, and what it means for the position in QQQM. This should feel like a proper news segment.

⑤ HOLDINGS RUNDOWN (~800 words)
   Cover the 9 primary holdings in order of portfolio weight (largest first). Allocate airtime proportionally — heavier weights get more sentences.
   MANDATORY FOR EVERY PRIMARY HOLDING — open with the session price move using exact figures from the price table above:
     Example: "Apple closed at one hundred eighty-five dollars and twenty cents, down one point four two percent on the session."
   Then: one sentence of news context or analyst commentary (if any) → what to watch next.
   For primary holdings with no news: still state the price move, then give one brief sentence of context (sector trend, relative performance vs index, or upcoming catalyst).
   If any primary holding has no news, you may substitute it with a secondary holding (${secondaryHoldings.map(h => h.ticker).join(", ")}) that has material news, but prioritize covering the primary 9.
   Use natural broadcast transitions ("Turning to...", "Over at...", "Meanwhile...").

⑥ NUMBERS TO WATCH (~80 words)
   Three specific, concrete data points or events coming in the next 24-48 hours that are directly relevant to this portfolio — earnings releases, Fed speakers, economic prints, product events. Give the exact name, timing, and why it matters for QQQM holders, briefly.

⑦ OUTRO (~40 words)
   Close with exactly: "This is The Portfolio Podcast for QQQ. We will be back same time the next business day with tomorrow's news." Then add one forward-looking sentence on what to watch for.

FORMAT RULES (strictly enforced):
- Write for ears only. No bullet points, headers, markdown, or section labels in the output.
- No financial advice. Report facts and analyst commentary. Never "you should buy/sell."
- ${sessionRule}
- Every holding in section ⑤ MUST open with its closing price and session % move — no exceptions, even for quiet sessions.
- The overall QQQ portfolio move (stated once, in the welcome) is percent-only — never state the portfolio's dollar P&L or total dollar value, anywhere in the script.
- Spell out all numbers as words when spoken (e.g. "one point four two percent", "two hundred eighty-three dollars and seventy-eight cents").
- Never state ticker symbols. Refer to every company by its full name only (e.g. "Apple", "Microsoft", "Alphabet") — never "AAPL," "A-A-P-L," or any other ticker form.
- Cite specific figures and sources when available.
- Never state, imply, or invent a personal name for the host, in any section.
- Output the spoken script only. Begin with "Hello, this is The Portfolio Podcast for QQQ..."`;
}

// ── Main export ────────────────────────────────────────────────────────────────

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

export async function generatePodcastScript(
  news: AggregatedNewsResult,
  dateLabel: string,
  snapshot: PortfolioSnapshot,
  isWeekend = false
): Promise<string> {
  const apiKey = requireApiKey();
  const prompt = buildPrompt(news, dateLabel, snapshot, isWeekend);

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
