"use client";

import { cn } from "@/lib/utils";

import {
  refreshMetricsStrokeColor,
  refreshMetricsTrackColor,
  type RefreshMetricsProgressView,
} from "../refresh-metrics-progress";

type Size = "sm" | "md";

const SIZE_PX: Record<Size, number> = {
  sm: 22,
  md: 28,
};

const HOLE_INSET: Record<Size, number> = {
  sm: 3,
  md: 4,
};

const FONT_PX: Record<Size, number> = {
  sm: 7.5,
  md: 9,
};

/**
 * Compact circular refresh progress — stroke fill + percent in the center.
 * Visual language mirrors Discovery pack `.tw-ring2` (conic stroke + hole + value),
 * scaled for toolbar / row use.
 */
export function RefreshMetricsProgressCircle({
  progress,
  size = "sm",
  className,
}: {
  progress: RefreshMetricsProgressView;
  size?: Size;
  className?: string;
}) {
  const px = SIZE_PX[size];
  const inset = HOLE_INSET[size];
  const stroke = refreshMetricsStrokeColor(progress.tone);
  const track = refreshMetricsTrackColor(progress.tone);
  const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
  const ariaLabel = `Metrics refresh ${progress.label}, ${percent}%`;

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center rounded-full", className)}
      style={{
        width: px,
        height: px,
        background: `conic-gradient(${stroke} 0 ${percent}%, ${track} ${percent}% 100%)`,
      }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span
        aria-hidden
        className="absolute rounded-full bg-white dark:bg-background"
        style={{ inset }}
      />
      <span
        className="relative z-[1] font-bold tabular-nums leading-none"
        style={{
          fontSize: FONT_PX[size],
          color:
            progress.tone === "progress"
              ? "var(--tw-bi, #0B52E0)"
              : stroke,
          fontFamily: "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace",
        }}
      >
        {percent}
      </span>
    </span>
  );
}
