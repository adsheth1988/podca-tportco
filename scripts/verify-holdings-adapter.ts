#!/usr/bin/env tsx
// Sanity-checks fetchLiveHoldings() against a real (sandbox) SnapTrade
// connection: weights sum to ~100, and no holding carries a dollar field.
// Requires DATABASE_URL, SNAPTRADE_CLIENT_ID, SNAPTRADE_CONSUMER_KEY,
// SNAPTRADE_SECRET_ENCRYPTION_KEY, and an already-linked test user.
//
// Usage: npx tsx scripts/verify-holdings-adapter.ts <snapTradeUserId> <userSecret>

import { fetchLiveHoldings } from "../src/lib/snaptrade/adapter";

async function main() {
  const [snapTradeUserId, userSecret] = process.argv.slice(2);
  if (!snapTradeUserId || !userSecret) {
    console.error("Usage: npx tsx scripts/verify-holdings-adapter.ts <snapTradeUserId> <userSecret>");
    process.exit(1);
  }

  const { holdings, portfolioTotalValue } = await fetchLiveHoldings(snapTradeUserId, userSecret);

  const weightSum = holdings.reduce((s, h) => s + h.weight, 0);
  console.log(`Holdings: ${holdings.length} | Weight sum: ${weightSum.toFixed(2)} (expect ~100)`);
  console.log(`Portfolio total value: $${portfolioTotalValue.toFixed(2)}`);

  if (Math.abs(weightSum - 100) > 1 && holdings.length > 0) {
    console.error(`FAIL: weight sum ${weightSum.toFixed(2)} is not ~100`);
    process.exit(1);
  }

  for (const h of holdings) {
    const keys = Object.keys(h);
    const dollarLike = keys.filter((k) => /price|value|dollar|amount/i.test(k));
    if (dollarLike.length > 0) {
      console.error(`FAIL: holding ${h.ticker} carries dollar-like field(s): ${dollarLike.join(", ")}`);
      process.exit(1);
    }
  }

  console.log("PASS: weights sum to ~100, no dollar fields on any holding.");
}

main();
