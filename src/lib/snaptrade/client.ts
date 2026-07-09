import "server-only";
import { Snaptrade } from "snaptrade-typescript-sdk";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in environment variables`);
  return value;
}

let client: Snaptrade | null = null;

export function getSnapTradeClient(): Snaptrade {
  if (!client) {
    client = new Snaptrade({
      clientId: requireEnv("SNAPTRADE_CLIENT_ID"),
      consumerKey: requireEnv("SNAPTRADE_CONSUMER_KEY"),
    });
  }
  return client;
}
