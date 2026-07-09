"use client";

import { useMemo } from "react";

import { CreatorLinkedPlatformIcons } from "@/components/creator/creator-linked-platform-icons";
import { CreatorProfileLink } from "@/components/creator/creator-profile-link";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import type { QuotationItemRow } from "@/features/quotations/types";
import { resolveQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import { bootstrapPlatformOptionsFromItem } from "@/lib/quotations/quotation-creator-platform-options";
import { cn } from "@/lib/utils";

type Props = {
  item: QuotationItemRow;
  optionCount: number;
  isFirstGroup: boolean;
  onOpenCreator?: () => void;
};

/** Visual separator + influencer identity (avatar, name) above that creator's option lines. */
export function QuotationCreatorGroupHeaderRow({
  item,
  optionCount,
  isFirstGroup,
  onOpenCreator,
}: Props) {
  const creatorProfileSource = useMemo(() => {
    const linked = bootstrapPlatformOptionsFromItem(item).map((p) => p.platform);
    return resolveQuotationCreatorProfileSource(item, linked);
  }, [item]);

  const linkedPlatforms = creatorProfileSource.linkedPlatforms ?? [];

  return (
    <TableRow
      className={cn(
        "hover:bg-muted/30",
        !isFirstGroup && "border-t-2 border-border"
      )}
    >
      <TableCell colSpan={10} className="bg-muted/25 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CreatorProfileLink
            source={creatorProfileSource}
            size="lg"
            avatarBadge="country"
            showPlatformBadge={false}
            showExternalIcon
            linkName={false}
            onNameClick={onOpenCreator}
            stopPropagation
            className="min-w-0 max-w-full"
            nameClassName="truncate"
            trailing={
              linkedPlatforms.length > 0 ? (
                <CreatorLinkedPlatformIcons platforms={linkedPlatforms} />
              ) : null
            }
          />
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {item.followers != null ? (
              <span className="tabular-nums">{formatCreatorCount(item.followers)} followers</span>
            ) : null}
            {optionCount > 1 ? (
              <span className="font-medium text-foreground">
                {optionCount} options
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
