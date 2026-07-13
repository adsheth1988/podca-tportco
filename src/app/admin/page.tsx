"use client";

import { useCallback, useEffect, useState } from "react";

interface WaitlistEntry {
  email: string;
  createdAt: string;
}

export default function AdminPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [approvingEmail, setApprovingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [waitlistRes, approvedRes] = await Promise.all([
        fetch("/api/waitlist", { cache: "no-store" }),
        fetch("/api/admin/approve", { cache: "no-store" }),
      ]);
      if (!waitlistRes.ok || !approvedRes.ok) throw new Error("Failed to load");

      const waitlistData = await waitlistRes.json();
      const approvedData = await approvedRes.json();
      setEntries(waitlistData.entries ?? []);
      setApproved(new Set((approvedData.approved ?? []).map((e: string) => e.toLowerCase())));
    } catch {
      setError("Couldn't load waitlist/approval data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(email: string) {
    setApprovingEmail(email);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Approve failed");
      setApproved((prev) => new Set(prev).add(email.toLowerCase()));
    } catch {
      setError(`Couldn't approve ${email}.`);
    } finally {
      setApprovingEmail(null);
    }
  }

  return (
    <div className="admin-shell">
      <h1 className="admin-title">Waitlist Approvals</h1>
      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-empty">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="admin-empty">No waitlist signups yet.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Joined</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isApproved = approved.has(entry.email.toLowerCase());
              return (
                <tr key={entry.email}>
                  <td>{entry.email}</td>
                  <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td className={isApproved ? "admin-status--approved" : "admin-status--pending"}>
                    {isApproved ? "Approved" : "Pending"}
                  </td>
                  <td>
                    {!isApproved && (
                      <button
                        className="admin-approve-btn"
                        onClick={() => approve(entry.email)}
                        disabled={approvingEmail === entry.email}
                      >
                        {approvingEmail === entry.email ? "Approving…" : "Approve"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
