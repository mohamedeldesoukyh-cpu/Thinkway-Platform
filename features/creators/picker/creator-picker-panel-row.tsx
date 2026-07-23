"use client";

import { CheckIcon } from "lucide-react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
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
        "creator-picker-card text-left transition-[border-color,box-shadow,background] duration-150",
        checked && "is-selected",
        !disabled && "cursor-pointer hover:border-[#d8dee9]",
        disabled && "pointer-events-none opacity-55"
      )}
    >
      <div className="creator-picker-card__head">
        <span className="shrink-0 pt-3" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={() => onToggle()}
            aria-label={`${checked ? "Deselect" : "Select"} ${vm.displayName}`}
          />
        </span>

        <div className="creator-picker-card__avatar-wrap shrink-0">
          <CreatorAvatarImage
            avatarUrl={vm.avatarUrl}
            profileUrl={vm.profileUrl}
            alt={vm.displayName}
            sizeClassName="size-[52px]"
            className="border-0 bg-[#f3f6fc]"
          />
          {vm.countryFlagCodes.length > 0 ? (
            <CountryFlagsStack
              countryCodes={vm.countryFlagCodes}
              size="sm"
              overlay
              className="creator-picker-card__flag"
            />
          ) : null}
          <span className="creator-picker-card__star">★ {vm.thinkwayStarLabel}</span>
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-tight tracking-[-0.01em] text-[#0d1220]">
                {vm.displayName}
              </p>
              {vm.handleLabel ? (
                <p className="mt-0.5 truncate text-[11px] leading-tight text-[#94a3b8]">
                  {vm.handleLabel}
                </p>
              ) : null}
              {vm.countryLabel !== "—" ? (
                <p className="mt-0.5 truncate text-[10px] leading-tight text-[#94a3b8]">
                  {vm.countryLabel}
                </p>
              ) : null}
            </div>
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
            <div className="creator-picker-card__categories mt-1.5">
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

      <div className="creator-picker-card__stats">
        <DiscoveryCreatorPlatformStatsBox platformStats={vm.platformStats} />
      </div>
    </div>
  );
}
