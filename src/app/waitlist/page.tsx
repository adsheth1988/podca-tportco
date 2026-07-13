"use client";

import { useState } from "react";
import Link from "next/link";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function WaitlistPage() {
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="waitlist-shell">
      <div className="waitlist-card">
        <div className="waitlist-icon">📻</div>
        <h1 className="waitlist-title">The Portfolio Podcast for QQQ</h1>
        <p className="waitlist-subtitle">
          A daily market recap covering the top holdings in QQQ — generated fresh every trading day.
        </p>

        {submitted ? (
          <div className="waitlist-success">
            You&rsquo;re on the list. We&rsquo;ll be in touch.
          </div>
        ) : (
          <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
            <input
              type="email"
              className="waitlist-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              aria-label="Email address"
            />
            <button type="submit" className="waitlist-btn" disabled={submitting}>
              {submitting ? "Joining…" : "Join the Waitlist"}
            </button>
            {error && <p className="waitlist-error">{error}</p>}
          </form>
        )}

        <div className="waitlist-divider" />

        <Link href="/" className="waitlist-podcast-link">
          Listen to the podcast →
        </Link>
      </div>
    </div>
  );
}
