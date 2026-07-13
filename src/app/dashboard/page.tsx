"use client";

import { useState, useEffect, useCallback } from "react";
import PodcastPlayer from "@/components/PodcastPlayer";
import EpisodeCard from "@/components/EpisodeCard";
import { Episode } from "@/lib/storage";
import { ETF_HOLDINGS } from "@/config/etf-holdings";

interface Quote {
  ticker: string;
  price: number;
  changePercent: number;
  changeDollar: number;
}

const ETF_NAMES: Record<string, string> = {
  SPY:  "S&P 500 ETF",
  QQQ:  "Nasdaq-100 ETF",
  SOXX: "Semiconductor ETF",
  IWM:  "Russell 2000 ETF",
  MEME: "Roundhill Meme ETF",
};

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function isMarketOpen(): boolean {
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return false;
  return mins >= 570 && mins < 960;
}

function useETClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
        }) + " ET"
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function Home() {
  const [episodes, setEpisodes]           = useState<Episode[]>([]);
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [quotes, setQuotes]               = useState<Quote[]>([]);
  const [marketOpen, setMarketOpen]       = useState(false);
  const [selectedETF, setSelectedETF]     = useState<string>("QQQ");
  const clock = useETClock();

  const fetchEpisodes = useCallback(async () => {
    try {
      const res = await fetch("/data/episodes.json", { cache: "no-store" });
      if (!res.ok) return;
      const list: Episode[] = await res.json();
      setEpisodes(list);
      if (list.length > 0) selectEpisode(list[0].id);
    } catch { /* silent */ }
  }, []); // eslint-disable-line

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/market-data", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setQuotes(data.quotes ?? []);
    } catch { /* silent */ }
  }, []);

  async function selectEpisode(id: string) {
    setActiveId(id);
    try {
      const res = await fetch(`/data/episodes/${id}.json`, { cache: "no-store" });
      if (!res.ok) return;
      setActiveEpisode(await res.json());
    } catch { /* silent */ }
  }

  useEffect(() => {
    setMarketOpen(isMarketOpen());
    fetchEpisodes();
    fetchQuotes();
    const q = setInterval(fetchQuotes, 30_000);
    const s = setInterval(() => setMarketOpen(isMarketOpen()), 60_000);
    return () => { clearInterval(q); clearInterval(s); };
  }, [fetchEpisodes, fetchQuotes]);

  const etfInfo     = ETF_HOLDINGS[selectedETF];
  const maxWeight   = etfInfo ? Math.max(...etfInfo.holdings.map(h => h.weight)) : 1;

  return (
    <div className="app-shell">

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header className="top-bar">
        <div className="top-bar-left">
          <span className="tb-icon">📻</span>
          <span className="tb-brand">Portfolio Podcast</span>
          <span className="tb-divider" />
          <span className="tb-sub">QQQ Daily</span>
        </div>
        <div className="top-bar-right">
          <span className={`market-badge ${marketOpen ? "market-badge--open" : "market-badge--closed"}`}>
            <span className="market-dot" />
            {marketOpen ? "Market Open" : "Market Closed"}
          </span>
          <span className="tb-clock">{clock}</span>
        </div>
      </header>

      {/* ── ETF Ticker Bar ───────────────────────────────────────────────── */}
      <div className="ticker-bar">
        {quotes.length === 0 ? (
          <span className="ticker-loading">Loading quotes…</span>
        ) : quotes.map((q) => (
          <div key={q.ticker} className="ticker-item">
            <span className="ticker-sym">{q.ticker}</span>
            <span className="ticker-price">${fmt(q.price)}</span>
            <span className={`ticker-chg ${q.changePercent >= 0 ? "pos" : "neg"}`}>
              {q.changePercent >= 0 ? "▲" : "▼"} {q.changePercent >= 0 ? "+" : ""}{fmt(q.changePercent)}%
            </span>
          </div>
        ))}
      </div>

      {/* ── Main Layout ──────────────────────────────────────────────────── */}
      <div className="main-layout">

        {/* ── Left Panel ───────────────────────────────────────────────── */}
        <aside className="left-panel">

          <div className="panel-section-header">Watchlist</div>

          <div className="watchlist">
            {quotes.length === 0 ? (
              <div className="wl-loading">Fetching quotes…</div>
            ) : quotes.map((q) => {
              const pos      = q.changePercent >= 0;
              const isActive = q.ticker === selectedETF;
              return (
                <div
                  key={q.ticker}
                  className={`wl-card ${isActive ? "wl-card--active" : ""}`}
                  onClick={() => setSelectedETF(q.ticker)}
                  title={`View ${q.ticker} holdings`}
                >
                  <div className="wl-card-top">
                    <div>
                      <div className="wl-ticker">{q.ticker}</div>
                      <div className="wl-name">{ETF_NAMES[q.ticker] ?? q.ticker}</div>
                    </div>
                    <div className="wl-price-col">
                      <div className="wl-price">${fmt(q.price)}</div>
                      <div className={`wl-chg ${pos ? "pos" : "neg"}`}>
                        {pos ? "+" : ""}{fmt(q.changeDollar)} ({pos ? "+" : ""}{fmt(q.changePercent)}%)
                      </div>
                    </div>
                  </div>
                  <div
                    className={`wl-bar ${pos ? "wl-bar--pos" : "wl-bar--neg"}`}
                    style={{ width: `${Math.min(Math.abs(q.changePercent) * 20, 100)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Holdings for selected ETF */}
          {etfInfo && (
            <>
              <div className="panel-section-header" style={{ marginTop: "0.5rem" }}>
                {selectedETF} Top Holdings
              </div>
              <div className="holdings-list">
                {etfInfo.holdings.map((h) => (
                  <div key={h.ticker} className="hl-row">
                    <div className="hl-left">
                      <span className="hl-ticker">{h.ticker}</span>
                      <span className="hl-name">{h.name.split(" ").slice(0, 2).join(" ")}</span>
                    </div>
                    <div className="hl-right">
                      <span className="hl-weight">{h.weight}%</span>
                      <div className="hl-bar-track">
                        <div className="hl-bar-fill" style={{ width: `${(h.weight / maxWeight) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* ── Right Panel ──────────────────────────────────────────────── */}
        <main className="right-panel">
          {activeEpisode ? (
            <>
              <div className="section-label">Now Playing</div>
              <PodcastPlayer episode={activeEpisode} />
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📻</div>
              <h2>No episode loaded</h2>
              <p>Episodes are generated daily at 5 PM ET on weekdays.</p>
              {episodes.length === 0 && (
                <p className="empty-sub">Check back after the next market close.</p>
              )}
            </div>
          )}

          {episodes.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: "2rem" }}>Past Episodes</div>
              <div className="episode-grid">
                {episodes.map((ep) => (
                  <EpisodeCard
                    key={ep.id}
                    episode={ep}
                    isActive={ep.id === activeId}
                    onClick={() => selectEpisode(ep.id)}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Disclosure ────────────────────────────────────────────────────────── */}
      <footer className="disclosure">
        Episodes are generated using Claude AI
      </footer>
    </div>
  );
}
