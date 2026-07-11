"use client";

import { useCallback, useEffect, useState } from "react";

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

interface AccountsResponse {
  connected: boolean;
  connections: ConnectionSummary[];
  accounts: AccountSummary[];
}

function fmtMoney(n: number | null, currency: string | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 2,
  });
}

function fmtNum(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function PortfolioPage() {
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/snaptrade/accounts", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load accounts");
      setData(await res.json());
    } catch {
      setError("Couldn't load your SnapTrade accounts. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/snaptrade/connect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start connection");
      const { redirectURI } = await res.json();
      window.location.href = redirectURI;
    } catch {
      setError("Couldn't start the SnapTrade connection. Try again.");
      setConnecting(false);
    }
  }

  return (
    <div className="pf-shell">
      <header className="pf-header">
        <h1 className="pf-title">Portfolio</h1>
        <button className="pf-btn pf-btn--ghost" onClick={fetchAccounts} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error && <div className="pf-error">{error}</div>}

      {loading && !data && <div className="pf-empty">Loading…</div>}

      {data && !data.connected && (
        <div className="pf-empty">
          <p className="pf-empty-text">No brokerage account connected yet.</p>
          <button className="pf-btn pf-btn--accent" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Opening SnapTrade…" : "Connect Brokerage Account"}
          </button>
        </div>
      )}

      {data && data.connected && (
        <>
          <div className="pf-connections">
            {data.connections.map((c) => (
              <div key={c.id} className={`pf-conn-badge ${c.disabled ? "pf-conn-badge--down" : "pf-conn-badge--up"}`}>
                <span className="pf-conn-dot" />
                {c.brokerageName ?? "Brokerage"}
                {c.disabled ? " (disconnected)" : ""}
              </div>
            ))}
            <button className="pf-btn pf-btn--ghost" onClick={handleConnect} disabled={connecting}>
              {connecting ? "Opening SnapTrade…" : "+ Connect Another"}
            </button>
          </div>

          {data.accounts.map((account) => (
            <section key={account.id} className="pf-account-card">
              <div className="pf-account-head">
                <div>
                  <div className="pf-account-name">{account.name ?? account.institutionName}</div>
                  <div className="pf-account-sub">{account.institutionName}</div>
                </div>
                <div className="pf-account-balances">
                  <div>
                    <div className="pf-balance-label">Total Value</div>
                    <div className="pf-balance-value">{fmtMoney(account.totalValue, account.currency)}</div>
                  </div>
                  <div>
                    <div className="pf-balance-label">Cash</div>
                    <div className="pf-balance-value">{fmtMoney(account.cash, account.currency)}</div>
                  </div>
                </div>
              </div>

              {account.positions.length > 0 ? (
                <table className="pf-positions-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Description</th>
                      <th>Units</th>
                      <th>Price</th>
                      <th>Market Value</th>
                      <th>Unrealized P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.positions.map((p, i) => (
                      <tr key={`${p.symbol}-${i}`}>
                        <td className="pf-symbol">{p.symbol}</td>
                        <td className="pf-desc">{p.description}</td>
                        <td>{fmtNum(p.units)}</td>
                        <td>{fmtMoney(p.price, account.currency)}</td>
                        <td>{fmtMoney(p.marketValue, account.currency)}</td>
                        <td className={p.openPnl != null ? (p.openPnl >= 0 ? "pf-pos" : "pf-neg") : ""}>
                          {fmtMoney(p.openPnl, account.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="pf-no-positions">No positions in this account.</div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
