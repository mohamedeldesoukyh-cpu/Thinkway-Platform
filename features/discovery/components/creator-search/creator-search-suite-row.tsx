"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { memo, useCallback, type CSSProperties } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DiscoverySuiteCell,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system/discovery-suite-grid";
import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "@/features/discovery/components/design-system/discovery-suite-cols";
import {
  DiscoveryCreatorFeedThumbs,
  DiscoveryCreatorPlatformStatsBox,
} from "@/features/discovery/components/discovery-creator-platform-stats";
import { InterestChips } from "@/features/discovery/components/discovery-interest-chips";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { ini } from "@/lib/discovery/suite/helpers";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

export const SEARCH_COLS = DISCOVERY_COLS.search;
export const SEARCH_MIN_W = DISCOVERY_GRID_MIN_W.search ?? 1180;

export const searchColsStyle = {
  "--cols": SEARCH_COLS,
} as CSSProperties;

type Props = {
  creator: UnifiedCreatorResult;
  selected: boolean;
  addedToShortlist?: boolean;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  workerOfflineHint?: boolean;
  onToggleSelect: () => void;
  onOpenCreator: () => void;
  onToggleShortlist?: () => void;
  onReject?: () => void;
};

/**
 * Search row on DiscoverySuite `--cols` (virtualizer-safe).
 * Each row is its own `.tw-g` reading `--cols` from the list wrapper — not a flex
 * width match, and not a single shared grid parent (virtualizer positions absolutely).
 */
export const CreatorSearchSuiteRow = memo(function CreatorSearchSuiteRow({
  creator,
  selected,
  addedToShortlist = false,
  platformFilter,
  isApifyAcquired,
  workerOfflineHint,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onReject,
}: Props) {
  const vm = buildDiscoveryCreatorViewModel(creator, {
    platformFilter,
    isApifyAcquired,
    showCampaignRelevance: false,
  });

  const stopBubble = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  }, []);

  return (
    <DiscoverySuiteRow
      selected={selected}
      className={cn(workerOfflineHint && "opacity-90")}
      onClick={onOpenCreator}
    >
      <DiscoverySuiteCell>
        <span onClick={stopBubble}>
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`${selected ? "Deselect" : "Select"} ${vm.displayName}`}
          />
        </span>
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <span className="tw-cw2">
          <span className="tw-avx relative overflow-hidden">
            {vm.avatarUrl ? (
              <CreatorAvatarImage
                avatarUrl={vm.avatarUrl}
                profileUrl={vm.profileUrl}
                alt={vm.displayName}
                sizeClassName="size-full"
                className="border-0"
              />
            ) : (
              <span aria-hidden>{ini(vm.displayName).slice(0, 2)}</span>
            )}
            {vm.countryFlagCodes.length > 0 ? (
              <span className="fl">
                <CountryFlagsStack
                  countryCodes={vm.countryFlagCodes}
                  size="sm"
                  overlay
                  className="size-full"
                />
              </span>
            ) : null}
          </span>
          <span style={{ minWidth: 0 }}>
            <button
              type="button"
              className="nm max-w-full min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left font-[inherit]"
              title={vm.displayName}
              onClick={(event) => {
                stopBubble(event);
                onOpenCreator();
              }}
            >
              {vm.displayName}
            </button>
            {vm.handleLabel ? <span className="hd">{vm.handleLabel}</span> : null}
            {vm.countryLabel !== "—" ? <span className="lo">{vm.countryLabel}</span> : null}
          </span>
        </span>
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <InterestChips
          interests={vm.categories}
          emptyLabel="No categories"
          variant="default"
          maxVisible={3}
        />
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <DiscoveryCreatorPlatformStatsBox platformStats={vm.platformStats} />
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <DiscoveryCreatorFeedThumbs publications={vm.feedPublications} />
      </DiscoverySuiteCell>

      <DiscoverySuiteCell align="end">
        <span className="inline-flex items-center gap-1" onClick={stopBubble}>
          {onToggleShortlist ? (
            <button
              type="button"
              className={cn(
                "discovery-search-exact-accept",
                addedToShortlist && "is-added"
              )}
              onClick={onToggleShortlist}
            >
              <CheckIcon aria-hidden />
              <span>{addedToShortlist ? "Added" : "Add to shortlist"}</span>
            </button>
          ) : null}
          {onReject ? (
            <button
              type="button"
              className="discovery-search-exact-reject"
              aria-label={`Delete ${vm.displayName}`}
              onClick={onReject}
            >
              <XIcon aria-hidden />
            </button>
          ) : null}
        </span>
      </DiscoverySuiteCell>
    </DiscoverySuiteRow>
  );
});

export function CreatorSearchSuiteHeader({
  total,
  allSelected,
  hasCreators,
  onToggleSelectAll,
  countLabel,
}: {
  total: number;
  allSelected: boolean | "indeterminate";
  hasCreators: boolean;
  onToggleSelectAll: () => void;
  countLabel?: string;
}) {
  const resolved =
    countLabel ?? `${total.toLocaleString()} Creator${total === 1 ? "" : "s"}`;

  return (
    <div className="tw-g tw-hr" role="row" style={searchColsStyle}>
      <DiscoverySuiteCell>
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleSelectAll}
          aria-label={`Select all ${total} shown`}
          disabled={!hasCreators}
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--tw-mut)]">
          Creator name
        </span>
        <span className="ml-2 text-[11px] text-[var(--tw-mut)]">{resolved}</span>
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--tw-mut)]">
          Category
        </span>
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--tw-mut)]">
          Statistics
        </span>
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--tw-mut)]">
          Content from feed
        </span>
      </DiscoverySuiteCell>
      <DiscoverySuiteCell align="end">
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--tw-mut)]">
          Action
        </span>
      </DiscoverySuiteCell>
    </div>
  );
}
