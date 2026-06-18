import { PORTFOLIO_HOLDINGS } from "@/config/portfolio";

export default function HoldingsBanner() {
  return (
    <div className="holdings-banner">
      <div className="holdings-scroll">
        {[...PORTFOLIO_HOLDINGS, ...PORTFOLIO_HOLDINGS].map((h, i) => (
          <span key={i} className="holding-chip">
            <span className="h-ticker">{h.ticker}</span>
            <span className="h-weight">{h.weight}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
