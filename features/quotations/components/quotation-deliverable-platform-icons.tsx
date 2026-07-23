"use client";

import { Loader2Icon } from "lucide-react";

import { CreatorLinkedPlatformIcons } from "@/components/creator/creator-linked-platform-icons";
import { Badge } from "@/components/ui/badge";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";

type Props = {
  platforms: string[];
  loading?: boolean;
  /** When true, show an "All Platforms" badge instead of platform logos. */
  allPlatforms?: boolean;
  /** Quotation row — 26px icon boxes matching redesign mock (overlapping when multi). */
  compact?: boolean;
  className?: string;
};

function normalizePlatforms(platforms: string[]): string[] {
  const seen = new Set<string>();
  const items: { platform: string }[] = [];
  for (const platform of platforms) {
    const key = canonicalPlatformKey(platform);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({ platform: key });
  }
  return sortPlatformsStable(items).map((item) => item.platform);
}

/** Platform logos or an All Platforms badge for a deliverable pricing row. */
export function QuotationDeliverablePlatformIcons({
  platforms,
  loading,
  allPlatforms,
  compact = false,
  className,
}: Props) {
  if (loading && platforms.length === 0 && !allPlatforms) {
    return (
      <Loader2Icon
        className="size-5 animate-spin text-muted-foreground"
        aria-label="Loading platforms"
      />
    );
  }

  if (allPlatforms) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "max-w-[4.5rem] whitespace-normal px-1.5 py-0.5 text-center text-[9px] leading-tight font-semibold uppercase",
          className
        )}
        aria-label="All Platforms"
      >
        All Platform
      </Badge>
    );
  }

  const ordered = normalizePlatforms(platforms);
  if (ordered.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  if (compact) {
    return (
      <span
        className={cn("inline-flex items-center", className)}
        aria-label={ordered.join(", ")}
        title={ordered.join(", ")}
      >
        {ordered.map((platform, index) => (
          <span
            key={platform}
            className={cn(
              "plat-ic relative inline-flex",
              index > 0 && "-ml-2"
            )}
            style={{ zIndex: index + 1 }}
          >
            <PlatformIcon platform={platform} size="sm" className="size-[15px]" />
          </span>
        ))}
      </span>
    );
  }

  return (
    <CreatorLinkedPlatformIcons platforms={ordered} variant="cell" className={className} />
  );
}
