"use client";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";

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

type CreatorLinkedPlatformIconsProps = {
  platforms: string[];
  /** `inline` — compact stack beside creator name; `cell` — larger stack for table cells. */
  variant?: "inline" | "cell";
  className?: string;
};

function cellIconSizeClass(count: number): string {
  if (count === 1) return "size-10";
  if (count === 2) return "size-9";
  if (count === 3) return "size-7";
  return "size-6";
}

function cellOverlapClass(count: number): string {
  if (count <= 2) return "-ml-2.5";
  if (count === 3) return "-ml-2";
  return "-ml-1.5";
}

/** Overlapping circular platform logos for multi-platform creators (Discovery / quotation pattern). */
export function CreatorLinkedPlatformIcons({
  platforms,
  variant = "inline",
  className,
}: CreatorLinkedPlatformIconsProps) {
  const ordered = normalizePlatforms(platforms);
  if (ordered.length === 0) return null;

  if (variant === "inline") {
    return (
      <span
        className={cn("flex shrink-0 items-center", className)}
        aria-label={ordered.join(", ")}
        title={ordered.join(", ")}
      >
        {ordered.map((platform, index) => (
          <span
            key={platform}
            className={cn("relative shrink-0", index > 0 && "-ml-1.5")}
            style={{ zIndex: index + 1 }}
          >
            <PlatformIcon
              platform={platform}
              size="xs"
              variant="logo"
              className="size-4 rounded-full ring-2 ring-background"
            />
          </span>
        ))}
      </span>
    );
  }

  const iconSizeClass = cellIconSizeClass(ordered.length);
  const overlapClass = cellOverlapClass(ordered.length);

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      aria-label={ordered.join(", ")}
    >
      {ordered.map((platform, index) => (
        <span
          key={platform}
          className={cn("relative shrink-0", index > 0 && overlapClass)}
          style={{ zIndex: index + 1 }}
        >
          <PlatformIcon
            platform={platform}
            size="md"
            variant="logo"
            className={cn(iconSizeClass, "rounded-full ring-2 ring-card")}
          />
        </span>
      ))}
    </div>
  );
}
