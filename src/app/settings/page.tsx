"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import PodcastPlayer from "@/components/PodcastPlayer";
import { Episode } from "@/lib/storage";

interface Holding {
  ticker: string;
  name: string;
  weight: number;
  sector: string;
  isPrimaryFocus?: boolean;
}

interface HoldingsResult {
  holdings: Holding[];
  portfolioTotalValue: number;
}

export default function SettingsPage() {
  const [connectStatus, setConnectStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [connectError, setConnectError] = useState<string | null>(null);

  const [holdings, setHoldings] = useState<HoldingsResult | null>(null);
  const [holdingsLoading, setHoldingsLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);

  const loadHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    try {
      const res = await fetch("/api/snaptrade/holdings", { cache: "no-store" });
      if (res.status === 400) {
        setConnected(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load holdings");
      setHoldings(await res.json());
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setHoldingsLoading(false);
    }
  }, []);

  const loadEpisodes = useCallback(async () => {
    try {
      const res = await fetch("/api/personal-episodes", { cache: "no-store" });
      if (!res.ok) return;
      const { episodes: list } = await res.json();
      setEpisodes(list ?? []);
      if (list?.length > 0) selectEpisode(list[0].id);
    } catch { /* silent */ }
  }, []); // eslint-disable-line

  async function selectEpisode(date: string) {
    setActiveId(date);
    try {
      const res = await fetch(`/api/personal-episodes/${date}`, { cache: "no-store" });
      if (!res.ok) return;
      const { episode } = await res.json();
      setActiveEpisode(episode);
    } catch { /* silent */ }
  }

  useEffect(() => {
    loadHoldings();
    loadEpisodes();
  }, [loadHoldings, loadEpisodes]);

  async function handleConnect() {
    setConnectStatus("connecting");
    setConnectError(null);
    try {
      const registerRes = await fetch("/api/snaptrade/register", { method: "POST" });
      if (!registerRes.ok) throw new Error("Registration failed");

      const connectRes = await fetch("/api/snaptrade/connect", { method: "POST" });
      if (!connectRes.ok) throw new Error("Could not get connect link");

      const { redirectUrl } = await connectRes.json();
      window.location.href = redirectUrl;
    } catch (e) {
      setConnectStatus("error");
      setConnectError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (holdingsLoading) {
    return <div className="admin-empty">Loading…</div>;
  }

  if (!connected) {
    return (
      <div className="waitlist-shell">
        <div className="waitlist-card">
          <div className="waitlist-icon">🔗</div>
          <h1 className="waitlist-title">Connect Your Brokerage</h1>
          <p className="waitlist-subtitle">
            Link a brokerage account to generate a personal daily recap of your actual holdings.
          </p>
          <button className="waitlist-btn" onClick={handleConnect} disabled={connectStatus === "connecting"}>
            {connectStatus === "connecting" ? "Connecting…" : "Connect brokerage"}
          </button>
          {connectError && <p className="waitlist-error">{connectError}</p>}
        </div>
      </div>
    );
  }

  const maxWeight = holdings && holdings.holdings.length > 0
    ? Math.max(...holdings.holdings.map((h) => h.weight))
    : 1;

  return (
    <div className="pf-shell">
      <header className="pf-header">
        <h1 className="pf-title">Your Portfolio</h1>
        <button className="pf-btn pf-btn--ghost" onClick={handleConnect} disabled={connectStatus === "connecting"}>
          {connectStatus === "connecting" ? "Opening SnapTrade…" : "Reconnect brokerage"}
        </button>
      </header>

      <section className="pf-account-card">
        <div className="pf-account-head">
          <div>
            <div className="pf-account-name">Aggregate Holdings</div>
            <div className="pf-account-sub">Across all connected accounts</div>
          </div>
          <div className="pf-account-balances">
            <div>
              <div className="pf-balance-label">Total Value</div>
              <div className="pf-balance-value">
                {holdings?.portfolioTotalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </div>
            </div>
          </div>
        </div>

        {holdings && holdings.holdings.length > 0 ? (
          <div className="holdings-list">
            {holdings.holdings.map((h) => (
              <div key={h.ticker} className="hl-row">
                <div className="hl-left">
                  <span className="hl-ticker">{h.ticker}</span>
                  <span className="hl-name">{h.name}</span>
                </div>
                <div className="hl-right">
                  <span className="hl-weight">{h.weight.toFixed(1)}%</span>
                  <div className="hl-bar-track">
                    <div className="hl-bar-fill" style={{ width: `${(h.weight / maxWeight) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pf-no-positions">No equity/ETF holdings found in linked accounts.</div>
        )}
      </section>

      <div className="section-label">Your Podcast</div>
      {activeEpisode ? (
        <PodcastPlayer
          episode={activeEpisode}
          title={`Your Portfolio Podcast — ${format(parseISO(activeEpisode.date), "MMMM d, yyyy")}`}
          subtitle="Personal Holdings Recap"
          downloadName={`My-Portfolio-${activeEpisode.date}`}
          fetchScript={async () => {
            const res = await fetch(`/api/personal-episodes/${activeEpisode.date}`, { cache: "no-store" });
            const data = await res.json();
            return data.episode?.script ?? "";
          }}
        />
      ) : (
        <div className="pf-no-positions">
          No episode yet — your first personal recap generates on the next daily run.
        </div>
      )}

      {episodes.length > 1 && (
        <>
          <div className="section-label" style={{ marginTop: "1.5rem" }}>Past Episodes</div>
          <div className="episode-grid">
            {episodes.map((ep) => (
              <button
                key={ep.id}
                className={`episode-card ${ep.id === activeId ? "episode-card--active" : ""}`}
                onClick={() => selectEpisode(ep.id)}
              >
                <div className="ep-date">{format(parseISO(ep.date), "MMM d, yyyy")}</div>
                <div className="ep-title">Your Portfolio Podcast</div>
                <div className="ep-meta">{ep.articleCount != null ? `${ep.articleCount} stories` : "Personal recap"}</div>
                {ep.id === activeId && <span className="ep-badge">Now Playing</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
