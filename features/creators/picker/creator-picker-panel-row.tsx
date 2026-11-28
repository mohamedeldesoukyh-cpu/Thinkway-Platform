"use client";

import { CheckIcon } from "lucide-react";

import { CreatorCardIdentity } from "@/features/discovery/components/creator-card-identity";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DiscoveryCreatorPlatformStatsBox } from "@/features/discovery/components/discovery-creator-platform-stats";
import { InterestChips } from "@/features/discovery/components/discovery-interest-chips";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import type { CreatorRowMeta } from "./creator-selection-types";

export function CreatorPickerPanelRow({
  creator,
  row,
  checked,
  onToggle,
}: {
  creator: UnifiedCreatorResult;
  row: CreatorRowMeta;
  checked: boolean;
  onToggle: () => void;
}) {
  const vm = buildDiscoveryCreatorViewModel(creator);
  const disabled = row.disabled;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-pressed={checked}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "cc-card text-left transition-[border-color,box-shadow,background] duration-150",
        checked && "is-selected",
        !disabled && "cursor-pointer hover:border-[#d8dee9]",
        disabled && "is-disabled"
      )}
    >
      <div className="cc-card-head">
        <span className="shrink-0 pt-1" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={() => onToggle()}
            aria-label={`${checked ? "Deselect" : "Select"} ${vm.displayName}`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <CreatorCardIdentity vm={vm} />
            {row.disabledBadge ? (
              <Badge
                variant={row.disabledBadge === "On list" ? "secondary" : "outline"}
                className="h-5 shrink-0 gap-0.5 px-1.5 text-[9px]"
              >
                {row.disabledBadge === "On list" ? <CheckIcon className="size-2.5" /> : null}
                {row.disabledBadge}
              </Badge>
            ) : null}
          </div>

          {vm.categories.length > 0 ? (
            <div className="cc-categories mt-1.5">
              <InterestChips
                interests={vm.categories}
                variant="icat"
                maxVisible={2}
                emptyLabel=""
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="cc-metrics">
        <DiscoveryCreatorPlatformStatsBox platformStats={vm.platformStats} brandIcons compact />
      </div>
    </div>
  );
}
