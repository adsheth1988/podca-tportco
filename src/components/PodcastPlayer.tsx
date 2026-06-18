"use client";

import { useRef, useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Episode } from "@/lib/storage";

interface Props {
  episode: Episode;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function PodcastPlayer({ episode }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showScript, setShowScript] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [fullScript, setFullScript] = useState<string>("");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onDur = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  async function loadScript() {
    if (scriptLoaded) return;
    const res = await fetch(`/api/episodes/${episode.id}`);
    const data = await res.json();
    setFullScript(data.episode?.script ?? "");
    setScriptLoaded(true);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
    setCurrent(Number(e.target.value));
  }

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="player-card">
      <audio ref={audioRef} src={episode.audioUrl ?? undefined} preload="metadata" />

      <div className="player-meta">
        <div className="player-icon">📈</div>
        <div>
          <h2 className="player-title">QQQM Daily — {format(parseISO(episode.date), "MMMM d, yyyy")}</h2>
          <p className="player-subtitle">QQQM Daily · Top 10 Holdings Recap</p>
        </div>
      </div>

      <div className="player-controls">
        <button className="ctrl-btn" onClick={() => skip(-15)} title="Back 15s">
          ↺ 15
        </button>
        <button className="play-btn" onClick={togglePlay}>
          {playing ? "⏸" : "▶"}
        </button>
        <button className="ctrl-btn" onClick={() => skip(30)} title="Forward 30s">
          30 ↻
        </button>
      </div>

      <div className="progress-row">
        <span className="time">{formatTime(current)}</span>
        <input
          type="range"
          className="progress-bar"
          min={0}
          max={duration || 100}
          value={current}
          onChange={seek}
          style={{ "--pct": `${pct}%` } as React.CSSProperties}
        />
        <span className="time">{duration ? formatTime(duration) : "--:--"}</span>
      </div>

      <div className="player-actions">
        <button
          className="transcript-toggle"
          onClick={() => {
            setShowScript(!showScript);
            if (!showScript) loadScript();
          }}
        >
          {showScript ? "Hide transcript" : "Show transcript"}
        </button>

        {episode.audioUrl && (
          <a
            className="download-btn"
            href={episode.audioUrl}
            download={`QQQM-Daily-${episode.date}.mp3`}
          >
            ↓ Download MP3
          </a>
        )}
      </div>

      {showScript && (
        <div className="transcript">
          {scriptLoaded ? fullScript : "Loading…"}
        </div>
      )}
    </div>
  );
}
