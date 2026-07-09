"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [status, setStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setStatus("connecting");
    setError(null);
    try {
      const registerRes = await fetch("/api/snaptrade/register", { method: "POST" });
      if (!registerRes.ok) throw new Error("Registration failed");

      const connectRes = await fetch("/api/snaptrade/connect", { method: "POST" });
      if (!connectRes.ok) throw new Error("Could not get connect link");

      const { redirectUrl } = await connectRes.json();
      window.location.href = redirectUrl;
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <div className="waitlist-shell">
      <div className="waitlist-card">
        <div className="waitlist-icon">🔗</div>
        <h1 className="waitlist-title">Connect Your Brokerage</h1>
        <p className="waitlist-subtitle">
          Link a brokerage account to generate a personal daily recap of your actual holdings.
        </p>
        <button className="waitlist-btn" onClick={handleConnect} disabled={status === "connecting"}>
          {status === "connecting" ? "Connecting…" : "Connect brokerage"}
        </button>
        {error && <p className="waitlist-error">{error}</p>}
      </div>
    </div>
  );
}
