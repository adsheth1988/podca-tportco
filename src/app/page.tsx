"use client";

import { useState, useEffect } from "react";
import PodcastPlayer from "@/components/PodcastPlayer";
import EpisodeCard from "@/components/EpisodeCard";
import HoldingsBanner from "@/components/HoldingsBanner";
import { Episode } from "@/lib/storage";

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    fetchEpisodes();
  }, []);

  async function fetchEpisodes() {
    try {
      const res = await fetch("/data/episodes.json", { cache: "no-store" });
      if (!res.ok) throw new Error("not found");
      const list: Episode[] = await res.json();
      setEpisodes(list);
      if (list.length > 0 && !activeId) {
        selectEpisode(list[0].id);
      }
    } catch {
      setStatusMsg("Failed to load episodes.");
    }
  }

  async function selectEpisode(id: string) {
    setActiveId(id);
    try {
      const res = await fetch(`/data/episodes/${id}.json`, { cache: "no-store" });
      if (!res.ok) throw new Error("not found");
      const episode: Episode = await res.json();
      setActiveEpisode(episode);
    } catch {
      setStatusMsg("Failed to load episode.");
    }
  }

  async function generateToday() {
    setGenerating(true);
    setStatusMsg("Fetching today's news…");
    try {
      const res = await fetch("/api/generate-episode");
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg(`Error: ${data.error}`);
        return;
      }
      setStatusMsg("Episode generated!");
      await fetchEpisodes();
      selectEpisode(data.id);
    } catch (e) {
      setStatusMsg(`Failed: ${e}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <header className="header">
        <div className="header-logo">🎙️</div>
        <div className="header-text">
          <h1>QQQM Daily</h1>
          <p>AI-generated market podcast · Top 10 holdings · Refreshed daily at 5 PM ET</p>
        </div>
      </header>

      <HoldingsBanner />

      <div className="main-grid">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">Episodes</div>
          {episodes.length === 0 ? (
            <div className="empty-sidebar">No episodes yet. Generate your first one.</div>
          ) : (
            episodes.map((ep) => (
              <EpisodeCard
                key={ep.id}
                episode={ep}
                isActive={ep.id === activeId}
                onClick={() => selectEpisode(ep.id)}
              />
            ))
          )}
        </aside>

        {/* Main panel */}
        <main className="panel">
          {activeEpisode ? (
            <PodcastPlayer episode={activeEpisode} />
          ) : (
            <div className="empty-panel">
              <span style={{ fontSize: "3rem" }}>🎙️</span>
              <h2>No episode selected</h2>
              <p>
                {episodes.length === 0
                  ? "Generate today's episode to get started."
                  : "Select an episode from the sidebar."}
              </p>
              {episodes.length === 0 && (
                <>
                  <button
                    className="generate-btn"
                    onClick={generateToday}
                    disabled={generating}
                  >
                    {generating ? "Generating…" : "Generate Today's Episode"}
                  </button>
                  {statusMsg && <p className="status-msg">{statusMsg}</p>}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
