import { Snaptrade } from "snaptrade-typescript-sdk";

let client: Snaptrade | null = null;

export function getSnapTradeClient(): Snaptrade {
  if (!client) {
    client = new Snaptrade({
      clientId: process.env.SNAPTRADE_CLIENT_ID,
      consumerKey: process.env.SNAPTRADE_CONSUMER_KEY,
    });
  }
  return client;
}
