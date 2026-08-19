"use client";

import { engagementBadge, engagementGaugePercent } from "../presentation";
import { formatEngagementPct, formatEngagementRateLabel, NOT_AVAILABLE } from "../format";

export function ReviewMeter({
  percent,
  label,
  value,
  badge,
}: {
  percent?: number;
  label: string;
  value?: string;
  badge?: { className: string; text: string };
}) {
  return (
    <section className="sec meter-sec">
      <p className="st">{label}</p>
      <p className="rp-big">
        <span className="n">{value ?? NOT_AVAILABLE}</span>
        {badge ? <span className={`badge ${badge.className}`}>{badge.text}</span> : null}
      </p>
      <div className="meter" aria-hidden="true">
        {percent != null ? <span className="mk" style={{ left: `calc(${Math.min(100, Math.max(0, percent))}% - 2px)` }} /> : null}
      </div>
      <div className="gauge-l">
        <span className="lo">Low</span>
        <span>Average</span>
        <span className="hi">Excellent</span>
      </div>
    </section>
  );
}

export function EngagementMeter({
  rate,
  platform,
}: {
  rate?: number | null;
  platform?: string;
}) {
  return (
    <ReviewMeter
      label={formatEngagementRateLabel(platform)}
      value={formatEngagementPct(rate)}
      percent={engagementGaugePercent(rate)}
      badge={engagementBadge(rate)}
    />
  );
}
