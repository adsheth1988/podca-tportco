import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSnapTradeClient } from "@/lib/snaptrade/client";
import { getConnectionForUser, saveConnection } from "@/lib/db/connections";

// Registers the signed-in app-user as a SnapTrade user if not already
// registered. Idempotent: safe to call repeatedly.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await getConnectionForUser(session.user.id);
  if (existing) {
    return NextResponse.json({ snapTradeUserId: existing.snapTradeUserId });
  }

  const client = getSnapTradeClient();
  const { data } = await client.authentication.registerSnapTradeUser({
    userId: session.user.id,
  });

  if (!data.userId || !data.userSecret) {
    return NextResponse.json({ error: "SnapTrade registration failed" }, { status: 502 });
  }

  await saveConnection(session.user.id, data.userId, data.userSecret);
  return NextResponse.json({ snapTradeUserId: data.userId });
}
