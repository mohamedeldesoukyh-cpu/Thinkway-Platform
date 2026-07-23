"use client";

import { filterPlatformsForDisplay } from "@/lib/creators/creator-centric";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { PlatformIcon } from "@/lib/performance/platform-icon";

/** Linked platform icons for Discovery browse rows. */
export function PlatformCell({
  creator,
  platformFilter,
}: {
  creator: UnifiedCreatorResult;
  platformFilter?: string[];
}) {
  const platforms = filterPlatformsForDisplay(creator.platforms, platformFilter);
  if (platforms.length === 0) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" title="Linked platforms">
      {platforms.map((platform) => (
        <PlatformIcon
          key={platform.id}
          platform={platform.platform}
          size="xs"
          className="size-4 shrink-0 rounded-full"
        />
      ))}
    </div>
  );
}
