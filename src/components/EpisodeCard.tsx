"use client";

import { Episode } from "@/lib/storage";
import { format, parseISO } from "date-fns";

interface Props {
  episode: Episode;
  isActive: boolean;
  onClick: () => void;
}

export default function EpisodeCard({ episode, isActive, onClick }: Props) {
  const dateLabel = format(parseISO(episode.date), "MMM d, yyyy");

  const title = `QQQ Daily — ${dateLabel}`;
  const meta = episode.articleCount != null ? `${episode.articleCount} stories · QQQ Top 10` : "QQQ Top 10";

  return (
    <button
      className={`episode-card ${isActive ? "episode-card--active" : ""}`}
      onClick={onClick}
    >
      <div className="ep-date">{dateLabel}</div>
      <div className="ep-title">{title}</div>
      <div className="ep-meta">{meta}</div>
      {isActive && <span className="ep-badge">Now Playing</span>}
    </button>
  );
}
