import { NextResponse } from "next/server";
import { getSnapTradeClient } from "@/lib/snaptrade/client";
import { getOrCreateSnapTradeUser } from "@/lib/snaptrade/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId, userSecret } = await getOrCreateSnapTradeUser();
    const snaptrade = getSnapTradeClient();

    const { data } = await snaptrade.authentication.loginSnapTradeUser({
      userId,
      userSecret,
    });

    if (!("redirectURI" in data) || !data.redirectURI) {
      return NextResponse.json(
        { error: "SnapTrade did not return a connection portal URL" },
        { status: 502 }
      );
    }

    return NextResponse.json({ redirectURI: data.redirectURI });
  } catch (err) {
    console.error("SnapTrade connect error:", err);
    return NextResponse.json(
      { error: "Failed to start SnapTrade connection" },
      { status: 500 }
    );
  }
}
