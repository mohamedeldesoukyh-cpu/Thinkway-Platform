"use client";

import { useEffect, useState } from "react";

type HomePoRingProps = {
  percent: number;
};

const RING_CIRCUMFERENCE = 157;

export function HomePoRing({ percent }: HomePoRingProps) {
  const [offset, setOffset] = useState(RING_CIRCUMFERENCE);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const clamped = Math.max(0, Math.min(100, percent));
      setOffset(RING_CIRCUMFERENCE * (1 - clamped / 100));
    }, 800);

    return () => window.clearTimeout(timer);
  }, [percent]);

  return (
    <div className="platform-v6-hs-ring">
      <svg width="80" height="80" viewBox="0 0 60 60" aria-hidden>
        <defs>
          <linearGradient id="platform-v6-hs-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0057FF" />
            <stop offset="100%" stopColor="#1A6FFF" />
          </linearGradient>
        </defs>
        <circle className="platform-v6-hs-ring-track" cx="30" cy="30" r="25" />
        <circle
          className="platform-v6-hs-ring-fill"
          cx="30"
          cy="30"
          r="25"
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="platform-v6-hs-ring-label">
        <div className="platform-v6-hs-ring-pct">{percent}%</div>
        <div className="platform-v6-hs-ring-sub">PO</div>
      </div>
    </div>
  );
}
