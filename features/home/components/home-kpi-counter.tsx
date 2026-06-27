"use client";

import { useEffect, useState } from "react";

import { formatMoneyCompact } from "@/lib/campaigns/utils";

type HomeKpiCounterProps = {
  value: number;
  currency: string;
  className?: string;
  delayMs?: number;
  durationMs?: number;
};

export function HomeKpiCounter({
  value,
  currency,
  className,
  delayMs = 600,
  durationMs = 1800,
}: HomeKpiCounterProps) {
  const [display, setDisplay] = useState(formatMoneyCompact(0, currency));

  useEffect(() => {
    let frame = 0;
    const startAt = Date.now() + delayMs;

    const tick = () => {
      const elapsed = Date.now() - startAt;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(formatMoneyCompact(Math.floor(eased * value), currency));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(formatMoneyCompact(value, currency));
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, currency, delayMs, durationMs]);

  return <span className={className}>{display}</span>;
}
