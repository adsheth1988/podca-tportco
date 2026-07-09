import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSnapTradeClient } from "@/lib/snaptrade/client";
import { getConnectionForUser } from "@/lib/db/connections";

// Returns a SnapTrade Connection Portal redirect URL for the signed-in user.
// The user must already be registered (call /api/snaptrade/register first).
// The returned URL expires in 5 minutes per SnapTrade's docs.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const connection = await getConnectionForUser(session.user.id);
  if (!connection) {
    return NextResponse.json({ error: "Not registered with SnapTrade yet" }, { status: 400 });
  }

  const client = getSnapTradeClient();
  const { data } = await client.authentication.loginSnapTradeUser({
    userId: connection.snapTradeUserId,
    userSecret: connection.userSecret,
  });

  if (!("redirectURI" in data) || !data.redirectURI) {
    return NextResponse.json({ error: "SnapTrade did not return a connect URL" }, { status: 502 });
  }

  return NextResponse.json({ redirectUrl: data.redirectURI });
}
