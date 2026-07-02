import { PORTFOLIO_BY_WEIGHT } from "@/config/portfolio";
import type { AggregatedNewsResult, NewsItem } from "@/types/news";
import type { PortfolioSnapshot } from "@/lib/prices";

// ── Config ─────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// claude-sonnet-4-6: best instruction following for structured long-form output.
// Tradeoff: ~2× cost of Haiku, but script quality is the heart of the product.
// Switch to claude-haiku-4-5 if cost becomes a concern after validating.
const MODEL = "claude-sonnet-4-6";

// 1,700 words ÷ 170 WPM = 10 minutes
const TARGET_WORD_COUNT = 1_700;

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

  // Weekday: name the day + exact pull time. Weekend: reference Friday's close only, no time.
  const sessionContext = isWeekend
    ? `SESSION: ${dateLabel} — as of market close (4:00 PM ET)`
    : `SESSION: ${dateLabel} — as of ${snapshot.generatedAtEST}`;

  const welcomeInstruction = isWeekend
    ? `Open with exactly: "Hello, I am Josh Weinberg — an AI-generated voice — and this is The Portfolio Podcast, an automated market recap. This is not financial advice. ${dayName}'s market close — here is your QQQM recap." Then state portfolio P&L.`
    : `Open with exactly: "Hello, I am Josh Weinberg — an AI-generated voice — and this is The Portfolio Podcast, an automated market recap. This is not financial advice. ${dayName}, as of ${snapshot.generatedAtEST} — here is your QQQM recap." Then state portfolio P&L.`;

  const sessionRule = isWeekend
    ? `Always reference this session as "${dayName}'s close" or "at ${dayName}'s market close." NEVER say "today," "this weekend," "Saturday," or "Sunday."`
    : `Always reference this session as "${dayName}'s session" or "as of ${snapshot.generatedAtEST} on ${dayName}." NEVER say "today."`;

  const portfolioLines = PORTFOLIO_BY_WEIGHT
    .map(h => `  ${h.ticker} (${h.name}, ${h.sector}) — ${h.weight}% of portfolio`)
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

  const noNewsHoldings = PORTFOLIO_BY_WEIGHT
    .filter(h => !news.portfolioArticles.some(a => a.ticker === h.ticker))
    .map(h => h.ticker)
    .join(", ");

  const portfolioPnLText = formatPnL(snapshot);

  return `You are the host of "The Portfolio Podcast". Your name is Josh Weinberg. Your tone is calm, authoritative, and direct. Think Bloomberg Radio: professional, data-driven, no hype.

${sessionContext}
${portfolioPnLText}

QQQM TOP 10 HOLDINGS (listed largest to smallest — prioritize coverage by weight):
${portfolioLines}

${dayName.toUpperCase()} PRICE MOVES (mandatory — use exact figures for every holding):
  TICKER  CLOSE PRICE   $ CHANGE   % CHANGE
${priceTable}

HOLDINGS WITH NO NEWS: ${noNewsHoldings || "none"}

TICKER-SPECIFIC NEWS (ranked by relevance):
${tickerNewsText || "No ticker-specific news found."}

BROAD MARKET CONTEXT:
${macroNewsText || "No macro news available."}

─────────────────────────────────────────────────────────
TASK: Write a complete, ready-to-record podcast script using the structure below.
Target: exactly ${TARGET_WORD_COUNT} words total.

STRUCTURE:

① WELCOME & DATE (~60 words)
   ${welcomeInstruction}
   Keep it factual and punchy.

② COLD OPEN (~50 words)
   Drop straight into the single most important story of the session — no additional introduction.
   Hook the listener immediately. End on a hard factual statement that creates tension.

③ MARKET SNAPSHOT (~100 words)
   Three sentences maximum on macro context: what drove the broad market in the session, any sector rotation, and one relevant macro data point (Fed, rates, jobs, etc.) if available. Include at least one index-level number (e.g. Nasdaq or S&P 500 % move). Crisp and factual.

④ TOP STORY (~200 words)
   The deepest dive of the episode. Take the most market-moving development from the holdings news and give it full context: what happened, the specific numbers, what analysts are saying, and what it means for the position in QQQM. This should feel like a proper news segment.

⑤ HOLDINGS RUNDOWN (~1,000 words)
   Cover ALL 9 remaining holdings in order of portfolio weight (largest first). Allocate airtime proportionally — heavier weights get more sentences.
   MANDATORY FOR EVERY HOLDING — open with the session price move using exact figures from the price table above:
     Example: "Apple closed at one hundred eighty-five dollars and twenty cents, down one point four two percent on the session."
   Then: news context (if any) → analyst commentary → what to watch next.
   For holdings with no news: still state the price move, then give one sentence of context (sector trend, relative performance vs index, or upcoming catalyst).
   Use natural broadcast transitions ("Turning to...", "Over at...", "Meanwhile...").

⑥ NUMBERS TO WATCH (~100 words)
   Three specific, concrete data points or events coming in the next 24-48 hours that are directly relevant to this portfolio — earnings releases, Fed speakers, economic prints, product events. Give the exact name, timing, and why it matters for QQQM holders.

⑦ OUTRO (~50 words)
   Clean sign-off. Remind the listener: next episode drops at 4:45 PM ET on the next trading day. One forward-looking sentence on what to watch for.

FORMAT RULES (strictly enforced):
- Write for ears only. No bullet points, headers, markdown, or section labels in the output.
- No financial advice. Report facts and analyst commentary. Never "you should buy/sell."
- Never imply Josh Weinberg is a real person, a live broadcast, or a human-staffed newsroom. The opening AI-generated disclosure must be spoken exactly as given — do not shorten, soften, or omit it.
- ${sessionRule}
- Every holding in section ⑤ MUST open with its closing price and session % move — no exceptions, even for quiet sessions.
- Spell out all numbers as words when spoken (e.g. "one point four two percent", "two hundred eighty-three dollars and seventy-eight cents").
- Refer to every holding by company name only — NEVER speak the ticker symbol or spell it out letter by letter. Say "Apple," not "Apple, A-A-P-L" or "A-A-P-L." Use the ticker only to look up the right company/price in the data above; it should never appear in the spoken output.
- Cite specific figures and sources when available.
- Output the spoken script only. Begin with "Hello, I am Josh Weinberg..."`;
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
