"use client";

import { PlatformIcon } from "@/lib/performance/platform-icon";
import type { UnifiedCreatorPlatform } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import { formatCreatorCount } from "./creator-search/creator-search-utils";

export type PlatformMetricKind = "followers" | "avg_views";

function platformMetricValue(
  platform: UnifiedCreatorPlatform,
  metric: PlatformMetricKind
): number | null {
  switch (metric) {
    case "followers":
      return platform.follower_count;
    case "avg_views":
      return platform.avg_views ?? null;
  }
}

function formatPlatformMetric(metric: PlatformMetricKind, value: number | null): string {
  if (value == null) return "—";
  return formatCreatorCount(value);
}

type PlatformMetricStackProps = {
  platforms: UnifiedCreatorPlatform[];
  metric: PlatformMetricKind;
  align?: "left" | "right";
  /** Compact typography for mobile stacked platform rows. */
  compact?: boolean;
  className?: string;
};

/** Stacked per-platform metric rows with a small platform badge beside each value. */
export function PlatformMetricStack({
  platforms,
  metric,
  align = "right",
  compact = false,
  className,
}: PlatformMetricStackProps) {
  if (platforms.length === 0) {
    return (
      <span className={cn("text-[12px] text-muted-foreground", className)}>—</span>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        align === "right" ? "items-end" : "items-start",
        className
      )}
    >
      {platforms.map((platform) => (
        <div
          key={platform.id}
          className={cn(
            "flex min-w-0 items-center gap-1",
            align === "right" && "justify-end"
          )}
        >
          <PlatformIcon
            platform={platform.platform}
            size="xs"
            className={cn("shrink-0 rounded-full", compact ? "size-3.5" : "size-4")}
          />
          <span
            className={cn(
              "font-semibold tabular-nums text-foreground",
              compact ? "text-[11px]" : "text-[12px]"
            )}
          >
            {formatPlatformMetric(metric, platformMetricValue(platform, metric))}
          </span>
        </div>
      ))}
    </div>
  );
}

type PlatformMetricsMobileBlockProps = {
  platforms: UnifiedCreatorPlatform[];
  avgEr: string;
  className?: string;
};

/** Mobile: one line per platform with followers and views; single ER below. */
export function PlatformMetricsMobileBlock({
  platforms,
  avgEr,
  className,
}: PlatformMetricsMobileBlockProps) {
  if (platforms.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className={cn("space-y-1", className)}>
      {platforms.map((platform) => (
        <div
          key={platform.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]"
        >
          <span className="flex items-center gap-1">
            <PlatformIcon
              platform={platform.platform}
              size="xs"
              className="size-3.5 shrink-0 rounded-full"
            />
            <span className="font-semibold tabular-nums text-foreground">
              {formatPlatformMetric("followers", platformMetricValue(platform, "followers"))}
            </span>
            <span className="text-muted-foreground">followers</span>
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">
              {formatPlatformMetric("avg_views", platformMetricValue(platform, "avg_views"))}
            </span>{" "}
            views
          </span>
        </div>
      ))}
      <div className="text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{avgEr}</span> avg ER
      </div>
    </div>
  );
}
