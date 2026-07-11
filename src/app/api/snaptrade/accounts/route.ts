import { NextResponse } from "next/server";
import { getSnapTradeClient } from "@/lib/snaptrade/client";
import { getOrCreateSnapTradeUser } from "@/lib/snaptrade/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PositionSummary {
  symbol: string;
  description: string;
  units: number | null;
  price: number | null;
  openPnl: number | null;
  marketValue: number | null;
}

interface AccountSummary {
  id: string;
  name: string | null;
  institutionName: string;
  totalValue: number | null;
  cash: number | null;
  currency: string | null;
  positions: PositionSummary[];
}

interface ConnectionSummary {
  id: string;
  brokerageName: string | null;
  disabled: boolean;
  createdDate: string | null;
}

export async function GET() {
  try {
    const { userId, userSecret } = await getOrCreateSnapTradeUser();
    const snaptrade = getSnapTradeClient();

    const { data: authorizations } =
      await snaptrade.connections.listBrokerageAuthorizations({
        userId,
        userSecret,
      });

    if (!authorizations || authorizations.length === 0) {
      return NextResponse.json({ connected: false, connections: [], accounts: [] });
    }

    const connections: ConnectionSummary[] = authorizations.map((auth) => ({
      id: auth.id ?? "",
      brokerageName: auth.brokerage?.name ?? null,
      disabled: auth.disabled ?? false,
      createdDate: auth.created_date ?? null,
    }));

    const { data: rawAccounts } = await snaptrade.accountInformation.listUserAccounts({
      userId,
      userSecret,
    });

    const accounts: AccountSummary[] = await Promise.all(
      (rawAccounts ?? []).map(async (account) => {
        const { data: balances } =
          await snaptrade.accountInformation.getUserAccountBalance({
            userId,
            userSecret,
            accountId: account.id,
          });
        const { data: positions } =
          await snaptrade.accountInformation.getUserAccountPositions({
            userId,
            userSecret,
            accountId: account.id,
          });

        const primaryBalance = balances?.[0] ?? null;

        return {
          id: account.id,
          name: account.name,
          institutionName: account.institution_name,
          totalValue: account.balance?.total?.amount ?? null,
          cash: primaryBalance?.cash ?? null,
          currency: account.balance?.total?.currency ?? primaryBalance?.currency?.code ?? null,
          positions: (positions ?? []).map((position) => ({
            symbol: position.symbol?.symbol?.symbol ?? "?",
            description: position.symbol?.symbol?.description ?? "",
            units: position.units ?? null,
            price: position.price ?? null,
            openPnl: position.open_pnl ?? null,
            marketValue:
              position.units != null && position.price != null
                ? position.units * position.price
                : null,
          })),
        };
      })
    );

    return NextResponse.json({ connected: true, connections, accounts });
  } catch (err) {
    console.error("SnapTrade accounts error:", err);
    return NextResponse.json(
      { error: "Failed to fetch SnapTrade accounts" },
      { status: 500 }
    );
  }
}
