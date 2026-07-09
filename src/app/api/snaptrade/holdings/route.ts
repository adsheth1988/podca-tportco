import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConnectionForUser } from "@/lib/db/connections";
import { fetchLiveHoldings } from "@/lib/snaptrade/adapter";

// Server-side only — never exposes raw dollar values per holding to the
// client, only what the adapter already returns (weights + aggregate total).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const connection = await getConnectionForUser(session.user.id);
  if (!connection) {
    return NextResponse.json({ error: "No brokerage connection found" }, { status: 400 });
  }

  const result = await fetchLiveHoldings(connection.snapTradeUserId, connection.userSecret);
  return NextResponse.json(result);
}
