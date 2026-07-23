"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2Icon, RotateCwIcon, SearchXIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  DiscoveryEmptyState,
  DiscoverySearchExactListSkeleton,
} from "@/features/discovery/components/design-system";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorCheckboxState } from "@/features/creators/picker/creator-selection-hooks";
import { AddMissingCreatorEmptyState } from "@/features/discovery/components/add-missing-creator-dialog";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";

import { CreatorSearchExactEmptyState } from "./creator-search-exact-empty-state";
import {
  CreatorSearchRecommendedSection,
  type CreatorSearchRecommendation,
} from "./creator-search-recommended-section";
import {
  CreatorSearchExactHeader,
  CreatorSearchExactRow,
} from "./creator-search-exact-row";
import {
  CreatorSearchHybridSectionHeader,
  type CreatorSearchHybridListItem,
} from "./creator-search-hybrid-sections";
import type { CreatorSearchIntentMode } from "./creator-search-intent-engine";
import {
  CreatorSearchToolbarControls,
  type CreatorSearchToolbarControlsProps,
} from "./creator-search-top-bar";
import type { CreatorSearchSortState } from "./creator-search-types";

const ROW_ESTIMATE = 148;
const SECTION_ESTIMATE = 52;

type Props = {
  creators: UnifiedCreatorResult[];
  hybridListItems?: CreatorSearchHybridListItem[];
  searchMode?: CreatorSearchIntentMode;
  sort?: CreatorSearchSortState;
  onSortChange?: (sort: CreatorSearchSortState) => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  total: number;
  selectedIds: Set<string>;
  shortlistedIds: Set<string>;
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onToggleSelectAll: () => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onToggleShortlist: (creator: UnifiedCreatorResult) => void;
  onRejectCreator: (creator: UnifiedCreatorResult) => void;
  onRefreshMetrics?: (
    creator: UnifiedCreatorResult,
    platformAccountId?: string | null
  ) => void;
  onStopRefresh?: (creator: UnifiedCreatorResult) => void;
  onStopAllRefresh?: () => void;
  inFlightCount?: number;
  onRetry: () => void;
  loadMoreRef: (node: HTMLDivElement | null) => void;
  platformFilter?: string[];
  showAddMissingCreator?: boolean;
  exactCreatorEmptyState?: boolean;
  searchQuery?: string;
  canSimplifyExactQuery?: boolean;
  onSearchWithFewerWords?: () => void;
  onMissingCreatorAdded?: (creator: UnifiedCreatorResult) => void;
  onMissingCreatorEnrichmentStatusChange?: (
    unifiedId: string,
    status: CreatorEnrichmentStatus
  ) => void;
  onMissingCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
  onCreatorDeleted?: (creator: UnifiedCreatorResult) => void;
  apifySourceUnifiedIds?: Set<string>;
  workerOfflineHint?: boolean;
  showCampaignRelevance?: boolean;
  showExactMatchesZeroHeader?: boolean;
  recommendations?: CreatorSearchRecommendation[];
  loadingRecommendations?: boolean;
  toolbar: CreatorSearchToolbarControlsProps;
};

type VirtualRowProps = {
  creator: UnifiedCreatorResult;
  selected: boolean;
  addedToShortlist: boolean;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  workerOfflineHint?: boolean;
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onToggleShortlist: (creator: UnifiedCreatorResult) => void;
  onRejectCreator: (creator: UnifiedCreatorResult) => void;
};

const CreatorSearchVirtualRow = memo(function CreatorSearchVirtualRow({
  creator,
  selected,
  addedToShortlist,
  platformFilter,
  isApifyAcquired,
  workerOfflineHint,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onRejectCreator,
}: VirtualRowProps) {
  const handleOpenCreator = useCallback(
    () => onOpenCreator(creator),
    [onOpenCreator, creator]
  );
  const handleToggleSelect = useCallback(
    () => onToggleSelect(creator),
    [onToggleSelect, creator]
  );
  const handleToggleShortlist = useCallback(
    () => onToggleShortlist(creator),
    [onToggleShortlist, creator]
  );
  const handleReject = useCallback(
    () => onRejectCreator(creator),
    [onRejectCreator, creator]
  );

  return (
    <CreatorSearchExactRow
      creator={creator}
      selected={selected}
      addedToShortlist={addedToShortlist}
      platformFilter={platformFilter}
      isApifyAcquired={isApifyAcquired}
      workerOfflineHint={workerOfflineHint}
      onToggleSelect={handleToggleSelect}
      onOpenCreator={handleOpenCreator}
      onToggleShortlist={handleToggleShortlist}
      onReject={handleReject}
    />
  );
});

export function CreatorSearchResultList({
  creators,
  hybridListItems,
  searchMode = "discovery",
  sort,
  loading,
  loadingMore,
  hasMore,
  error,
  total,
  selectedIds,
  shortlistedIds,
  onToggleSelectAll,
  onOpenCreator,
  onToggleShortlist,
  onRejectCreator,
  onStopAllRefresh,
  inFlightCount = 0,
  onRetry,
  loadMoreRef,
  platformFilter,
  showAddMissingCreator = false,
  exactCreatorEmptyState = false,
  searchQuery = "",
  canSimplifyExactQuery = false,
  onSearchWithFewerWords,
  onMissingCreatorAdded,
  onMissingCreatorEnrichmentStatusChange,
  onMissingCreatorUpdated,
  toolbar,
  apifySourceUnifiedIds,
  workerOfflineHint,
  showExactMatchesZeroHeader = false,
  recommendations = [],
  loadingRecommendations = false,
  onToggleSelect,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerToolbar = <CreatorSearchToolbarControls {...toolbar} />;

  const listItems = useMemo<CreatorSearchHybridListItem[]>(() => {
    if (hybridListItems && hybridListItems.length > 0) return hybridListItems;
    return creators.map((creator, index) => ({
      kind: "creator" as const,
      id: creator.unified_id,
      creator,
      rank: index + 1,
    }));
  }, [creators, hybridListItems]);

  const visibleCreatorIds = useMemo(
    () =>
      listItems
        .filter((item): item is Extract<CreatorSearchHybridListItem, { kind: "creator" }> => item.kind === "creator")
        .map((item) => item.creator.unified_id),
    [listItems]
  );

  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      listItems[index]?.kind === "section" ? SECTION_ESTIMATE : ROW_ESTIMATE,
    overscan: 12,
    getItemKey: (index) => listItems[index]?.id ?? index,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    virtualizer.scrollToIndex(0);
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset layout when sort identity changes
  }, [sort?.field, sort?.direction]);

  const allSelected = useMemo(
    () => resolveCreatorCheckboxState(visibleCreatorIds, selectedIds),
    [visibleCreatorIds, selectedIds]
  );

  const hasCreators = visibleCreatorIds.length > 0;
  const exactMatchesCountLabel = showExactMatchesZeroHeader
    ? `Exact Matches — ${total.toLocaleString()} creator${total === 1 ? "" : "s"}`
    : undefined;

  return (
    <div className="discovery-search-exact-root">
      <div className="discovery-search-exact-header-bar">
        <CreatorSearchExactHeader
          total={total}
          allSelected={allSelected}
          hasCreators={hasCreators}
          onToggleSelectAll={onToggleSelectAll}
          toolbar={headerToolbar}
          countLabel={exactMatchesCountLabel}
        />
        {inFlightCount > 0 && onStopAllRefresh ? (
          <div className="flex justify-end pb-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="h-7 shrink-0 rounded-full text-xs"
              onClick={onStopAllRefresh}
            >
              Stop all refresh ({inFlightCount})
            </Button>
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} className="discovery-search-exact-scroll">
        {error ? (
          <DiscoveryEmptyState
            title="Search failed"
            description={error}
            icon={SearchXIcon}
            className="[&>div:first-child]:bg-destructive/10 [&>div:first-child]:text-destructive"
          >
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onRetry()}>
              <RotateCwIcon className="size-3.5" />
              Try again
            </Button>
          </DiscoveryEmptyState>
        ) : loading && !hasCreators ? (
          <DiscoverySearchExactListSkeleton />
        ) : !hasCreators ? (
          <>
            {exactCreatorEmptyState ? (
              <CreatorSearchExactEmptyState
                query={searchQuery}
                canSimplifyQuery={canSimplifyExactQuery}
                onSearchWithFewerWords={() => onSearchWithFewerWords?.()}
                onMissingCreatorAdded={onMissingCreatorAdded}
                onMissingCreatorEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
                onMissingCreatorUpdated={onMissingCreatorUpdated}
              />
            ) : (
              <DiscoveryEmptyState
                title={
                  showAddMissingCreator
                    ? "No creators match your search"
                    : showExactMatchesZeroHeader
                      ? "No exact matches"
                      : "No creators match your filters"
                }
                description={
                  showAddMissingCreator
                    ? "Try a different spelling or handle, or add the creator by profile link."
                    : showExactMatchesZeroHeader
                      ? "Your filters are still applied. Review recommended creators below for the closest matches."
                      : "Try widening the follower range, removing a category, or clearing some filters."
                }
                icon={SearchXIcon}
              >
                <AddMissingCreatorEmptyState
                  visible={showAddMissingCreator}
                  className="mt-1"
                  onSuccess={onMissingCreatorAdded}
                  onEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
                  onCreatorUpdated={onMissingCreatorUpdated}
                />
              </DiscoveryEmptyState>
            )}
            {showExactMatchesZeroHeader ? (
              <CreatorSearchRecommendedSection
                recommendations={recommendations}
                loading={loadingRecommendations}
                platformFilter={platformFilter}
                selectedIds={selectedIds}
                shortlistedIds={shortlistedIds}
                onToggleSelect={onToggleSelect}
                onOpenCreator={onOpenCreator}
                onToggleShortlist={onToggleShortlist}
                onRejectCreator={onRejectCreator}
              />
            ) : null}
          </>
        ) : (
          <>
            {searchMode === "hybrid" && hasCreators ? (
              <p className="pb-2 text-[11px] text-muted-foreground">Hybrid match</p>
            ) : null}
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = listItems[virtualRow.index];
                if (!item) return null;

                if (item.kind === "section") {
                  return (
                    <div
                      key={item.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute top-0 left-0 w-full"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <CreatorSearchHybridSectionHeader
                        title={item.title}
                        subtitle={item.subtitle}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <CreatorSearchVirtualRow
                      creator={item.creator}
                      selected={selectedIds.has(item.creator.unified_id)}
                      addedToShortlist={shortlistedIds.has(item.creator.unified_id)}
                      platformFilter={platformFilter}
                      isApifyAcquired={apifySourceUnifiedIds?.has(item.creator.unified_id)}
                      workerOfflineHint={workerOfflineHint}
                      onToggleSelect={onToggleSelect}
                      onOpenCreator={onOpenCreator}
                      onToggleShortlist={onToggleShortlist}
                      onRejectCreator={onRejectCreator}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!error ? <div ref={loadMoreRef} className="h-12" aria-hidden /> : null}
        {loadingMore ? (
          <div className="flex justify-center py-3">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {!hasMore && hasCreators && !error ? (
          <p className="py-3 text-center text-[10px] text-muted-foreground">End of results</p>
        ) : null}
      </div>
    </div>
  );
}
