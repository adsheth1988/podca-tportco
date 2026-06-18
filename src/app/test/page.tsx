// Temporary placeholder — the real UI (from PortfolioPlaybook.jsx)
// will be integrated in Slice 6 once the full pipeline is wired up.

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "monospace", color: "#E4E8F0" }}>
      <p style={{ color: "#C8A84B", fontSize: "11px", letterSpacing: "0.2em" }}>
        THE PORTFOLIO PLAYBOOK
      </p>
      <h1 style={{ margin: "8px 0 24px", fontSize: "28px" }}>
        Slice 3 — News Layer Active
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <a href="/api/news" style={{ color: "#6B8AE4" }}>
          GET /api/news → test Marketaux + TheNewsAPI fetch ↗
        </a>
      </div>
    </main>
  );
}
