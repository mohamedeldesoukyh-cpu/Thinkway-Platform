"use client";

import { engagementBadge, engagementGaugePercent, LEVEL_METER_SEGMENTS, levelMeterActiveSegment } from "../presentation";
import { formatEngagementPct, formatEngagementRateLabel, NOT_AVAILABLE } from "../format";
import { ReviewPlatformMark } from "./review-platform-mark";

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

export function SegmentedLevelMeter({ percent }: { percent?: number }) {
  const active = percent == null ? 0 : levelMeterActiveSegment(percent);
  return (
    <>
      <div className="seg-meter" aria-hidden="true">
        {Array.from({ length: LEVEL_METER_SEGMENTS }, (_, index) => {
          const n = index + 1;
          const tone = n < active ? "on" : n === active ? "now" : "";
          return <span key={n} className={tone} />;
        })}
      </div>
      <div className="gauge-l">
        <span>Low</span>
        <span>Average</span>
        <span>Excellent</span>
      </div>
    </>
  );
}

export function ArcDialMeter({
  percent,
  value,
  badge,
}: {
  percent: number;
  value: string;
  badge?: { className: string; text: string };
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="arc-dial">
      <svg className="arc-svg" viewBox="0 0 120 72" aria-hidden="true">
        <path
          d="M14 62 A 46 46 0 0 1 106 62"
          fill="none"
          stroke="#eaf1ff"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M14 62 A 46 46 0 0 1 106 62"
          fill="none"
          stroke="#0057FF"
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${clamped} 100`}
        />
      </svg>
      <div className="arc-val">
        <p className="rp-big">
          <span className="n">{value}</span>
        </p>
        {badge ? <span className={`badge ${badge.className}`}>{badge.text}</span> : null}
      </div>
    </div>
  );
}

export function EngagementMeter({
  rate,
  platform,
}: {
  rate?: number | null;
  platform?: string;
}) {
  const badge = engagementBadge(rate);
  return (
    <section className="sec meter-sec">
      <p className="st">{formatEngagementRateLabel(platform)}</p>
      <p className="rp-big er-head">
        {platform ? <ReviewPlatformMark platform={platform} /> : null}
        <span className="n">{formatEngagementPct(rate)}</span>
        {badge ? <span className={`badge ${badge.className}`}>{badge.text}</span> : null}
      </p>
      <SegmentedLevelMeter percent={engagementGaugePercent(rate)} />
    </section>
  );
}
