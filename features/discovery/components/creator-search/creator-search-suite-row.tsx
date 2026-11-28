
import { CheckIcon, MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { memo, useCallback, type CSSProperties } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  DiscoverySuiteCell,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system/discovery-suite-grid";
import { CreatorCardIdentity, CreatorCardStatsHeader } from "@/features/discovery/components/creator-card-identity";
import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "@/features/discovery/components/design-system/discovery-suite-cols";
import {
  DiscoveryCreatorFeedThumbs,
  DiscoveryCreatorPlatformStatsBox,
} from "@/features/discovery/components/discovery-creator-platform-stats";
import { InterestChips } from "@/features/discovery/components/discovery-interest-chips";
import { RefreshMetricsProgressCircle } from "@/features/discovery/enrichment/components/refresh-metrics-progress-circle";
import { useRefreshMetricsProgressCircle } from "@/features/discovery/enrichment/use-refresh-metrics-progress-circle";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

export const SEARCH_COLS = DISCOVERY_COLS.search;
export const SEARCH_MIN_W = DISCOVERY_GRID_MIN_W.search ?? 1180;

export const relevanceColsStyle = { "--cols": `${SEARCH_COLS} 140px` } as CSSProperties;

export const searchColsStyle = {
  "--cols": SEARCH_COLS,
} as CSSProperties;

type Props = {
  creator: UnifiedCreatorResult;
  relevanceLabel?: "Relevance" | "Match";
  showRelevance?: boolean;
  selected: boolean;
  index?: number;
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
  showRelevance,
  relevanceLabel = "Relevance",
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
  const refreshProgress = useRefreshMetricsProgressCircle({
    enrichmentStatus: creator.enrichment_status,
  });

  const stopBubble = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  }, []);

  return (
    <DiscoverySuiteRow
      selected={selected}
      className={cn("cc-discovery", workerOfflineHint && "opacity-90")}
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
        <CreatorCardIdentity vm={vm} onOpen={onOpenCreator} />
          {refreshProgress ? (
            <span className="mt-1 inline-flex" onClick={stopBubble}>
              <RefreshMetricsProgressCircle progress={refreshProgress} />
            </span>
          ) : null}

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
        <DiscoveryCreatorPlatformStatsBox platformStats={vm.platformStats} compact brandIcons />
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${vm.displayName}`}><MoreHorizontalIcon className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onOpenCreator}>View creator</DropdownMenuItem>
              <DropdownMenuItem onSelect={onToggleSelect}>{selected ? "Deselect creator" : "Select creator"}</DropdownMenuItem>
              {onToggleShortlist && <DropdownMenuItem onSelect={onToggleShortlist}>Add to shortlist</DropdownMenuItem>}
              {onReject && <DropdownMenuItem onSelect={onReject} className="text-destructive">Delete creator</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </DiscoverySuiteCell>
      {showRelevance ? <DiscoverySuiteCell>
        <span onClick={stopBubble}><Popover>
          <PopoverTrigger asChild><Button variant="outline" size="sm" aria-label={`${relevanceLabel} for ${vm.displayName}`}>{creator.discovery_relevance?.score == null ? "No score" : `${creator.discovery_relevance.score}%`}</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-72 text-xs">
          <p className="font-semibold">{relevanceLabel}</p>
          {creator.discovery_relevance?.score == null ? <p className="mt-2">These filters qualify creators but do not provide enough detail to rank their relevance.</p> : null}
          <ul className="mt-2 space-y-1">{creator.discovery_relevance?.reasons.map((r,index) => <li key={index}>{r.dimension}: {r.outcome}{r.detail ? ` — ${r.detail}` : ""}</li>)}</ul>
          </PopoverContent>
        </Popover></span>
      </DiscoverySuiteCell> : null}
    </DiscoverySuiteRow>
  );
});

export function CreatorSearchSuiteHeader({
  total,
  allSelected,
  hasCreators,
  onToggleSelectAll,
  countLabel,
  showRelevance,
  relevanceLabel = "Relevance",
}: {
  total: number;
  allSelected: boolean | "indeterminate";
  hasCreators: boolean;
  onToggleSelectAll: () => void;
  countLabel?: string;
  relevanceLabel?: "Relevance" | "Match";
  showRelevance?: boolean;
}) {
  const resolved =
    countLabel ?? `${total.toLocaleString()} Creator${total === 1 ? "" : "s"}`;

  return (
    <div className="tw-g tw-hr" role="row" style={showRelevance ? relevanceColsStyle : searchColsStyle}>
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
        <CreatorCardStatsHeader />
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
      {showRelevance ? <DiscoverySuiteCell>{relevanceLabel}</DiscoverySuiteCell> : null}
    </div>
  );
}
