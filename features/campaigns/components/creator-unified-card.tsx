"use client";

import { Button } from "@/components/ui/button";
import { CreatorSourceBadge } from "@/features/campaigns/components/creator-source-badge";
import { DiscoveryCreatorExactRow } from "@/features/discovery/components/discovery-creator-exact-row";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

type CreatorUnifiedCardProps = {
  creator: UnifiedCreatorResult;
  selected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
  onOpenDetail?: () => void;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  compact?: boolean;
};

/** Campaign browser card — exact-row layout with preserved selection and actions. */
export function CreatorUnifiedCard({
  creator,
  selected = false,
  onToggleSelect,
  onOpenDetail,
  onPrimaryAction,
  primaryActionLabel,
  compact = false,
}: CreatorUnifiedCardProps) {
  const openDetail = onOpenDetail ?? (() => undefined);

  return (
    <DiscoveryCreatorExactRow
      creator={creator}
      selected={selected}
      selectable={Boolean(onToggleSelect)}
      showFeed={!compact}
      rowBehavior="open-detail"
      onToggleSelect={() => onToggleSelect?.(!selected)}
      onOpenCreator={openDetail}
      meta={<CreatorSourceBadge source={creator.source_type} />}
      actions={
        onPrimaryAction && primaryActionLabel ? (
          <button
            type="button"
            className="discovery-search-exact-accept"
            onClick={(event) => {
              event.stopPropagation();
              onPrimaryAction();
            }}
          >
            {primaryActionLabel}
          </button>
        ) : onOpenDetail ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-[38px] rounded-[10px] px-3 text-xs font-semibold"
            onClick={(event) => {
              event.stopPropagation();
              openDetail();
            }}
          >
            View details
          </Button>
        ) : undefined
      }
    />
  );
}
