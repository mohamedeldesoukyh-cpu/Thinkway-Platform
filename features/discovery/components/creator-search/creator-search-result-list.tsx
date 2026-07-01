"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2Icon, RotateCwIcon, SearchXIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorCheckboxState } from "@/features/creators/picker/creator-selection-hooks";
import { AddMissingCreatorEmptyState } from "@/features/discovery/components/add-missing-creator-dialog";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";

import { CreatorSearchExactEmptyState } from "./creator-search-exact-empty-state";
import {
  CreatorSearchHybridSectionHeader,
  type CreatorSearchHybridListItem,
} from "./creator-search-hybrid-sections";
import type { CreatorSearchIntentMode } from "./creator-search-intent-engine";

import {
  CreatorResultGridHeader,
  CreatorResultRow,
} from "../creator-result-row";

const ROW_ESTIMATE = 92;
const SECTION_ESTIMATE = 52;

import type { CreatorSearchSortState } from "./creator-search-types";

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
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onToggleSelectAll: () => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onAddToList: (creator: UnifiedCreatorResult) => void;
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
  /** When true, show "Add missing creator" in the empty state. */
  showAddMissingCreator?: boolean;
  /** Exact-creator lookup with zero handle/name matches (hide fuzzy suggestions). */
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
};

type VirtualRowProps = {
  creator: UnifiedCreatorResult;
  rank: number;
  selected: boolean;
  platformFilter?: string[];
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onAddToList: (creator: UnifiedCreatorResult) => void;
  onRefreshMetrics?: (
    creator: UnifiedCreatorResult,
    platformAccountId?: string | null
  ) => void;
  onStopRefresh?: (creator: UnifiedCreatorResult) => void;
};

const CreatorSearchVirtualRow = memo(function CreatorSearchVirtualRow({
  creator,
  rank,
  selected,
  platformFilter,
  onToggleSelect,
  onOpenCreator,
  onAddToList,
  onRefreshMetrics,
  onStopRefresh,
}: VirtualRowProps) {
  const handleToggleSelect = useCallback(
    () => onToggleSelect(creator),
    [onToggleSelect, creator]
  );
  const handleOpenCreator = useCallback(
    () => onOpenCreator(creator),
    [onOpenCreator, creator]
  );
  const handleAddToList = useCallback(
    () => onAddToList(creator),
    [onAddToList, creator]
  );
  const handleRefreshMetrics = useCallback(
    (platformAccountId?: string | null) => onRefreshMetrics?.(creator, platformAccountId),
    [onRefreshMetrics, creator]
  );
  const handleStopRefresh = useCallback(
    () => onStopRefresh?.(creator),
    [onStopRefresh, creator]
  );

  return (
    <CreatorResultRow
      creator={creator}
      rank={rank}
      selected={selected}
      variant="search"
      platformFilter={platformFilter}
      onToggleSelect={handleToggleSelect}
      onOpenCreator={handleOpenCreator}
      onAddToList={handleAddToList}
      onRefreshMetrics={onRefreshMetrics ? handleRefreshMetrics : undefined}
      onStopRefresh={onStopRefresh ? handleStopRefresh : undefined}
    />
  );
});

function ResultSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-border px-4 py-3 md:px-5">
      <Skeleton className="size-4 rounded" />
      <Skeleton className="size-12 rounded-full" />
      <div className="w-[200px] space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className="hidden flex-1 gap-1.5 md:flex">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="hidden h-8 w-24 md:block" />
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

export function CreatorSearchResultList({
  creators,
  hybridListItems,
  searchMode = "discovery",
  sort,
  onSortChange,
  loading,
  loadingMore,
  hasMore,
  error,
  total,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenCreator,
  onAddToList,
  onRefreshMetrics,
  onStopRefresh,
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
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 md:px-5">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleSelectAll}
          aria-label="Select all loaded creators"
          disabled={!hasCreators}
        />
        <span className="text-[12px] font-medium text-muted-foreground">
          {loading && !hasCreators
            ? "Searching…"
            : `${total.toLocaleString()} ${total === 1 ? "result" : "results"}`}
          {searchMode === "hybrid" && hasCreators ? (
            <span className="ml-1 text-muted-foreground/70">· hybrid match</span>
          ) : null}
        </span>
        {inFlightCount > 0 && onStopAllRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="ml-auto h-7 shrink-0 rounded-full text-xs"
            onClick={onStopAllRefresh}
          >
            Stop all refresh ({inFlightCount})
          </Button>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-y-contain">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <SearchXIcon className="size-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Search failed</p>
              <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
              <RotateCwIcon className="size-3.5" />
              Try again
            </Button>
          </div>
        ) : loading && !hasCreators ? (
          <div>
            <CreatorResultGridHeader variant="search" sort={sort} onSortChange={onSortChange} />
            {Array.from({ length: 8 }).map((_, i) => (
              <ResultSkeleton key={i} />
            ))}
          </div>
        ) : !hasCreators ? (
          exactCreatorEmptyState ? (
            <CreatorSearchExactEmptyState
              query={searchQuery}
              canSimplifyQuery={canSimplifyExactQuery}
              onSearchWithFewerWords={() => onSearchWithFewerWords?.()}
              onMissingCreatorAdded={onMissingCreatorAdded}
              onMissingCreatorEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
              onMissingCreatorUpdated={onMissingCreatorUpdated}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <SearchXIcon className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {showAddMissingCreator
                    ? "No creators match your search"
                    : "No creators match your filters"}
                </p>
                <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
                  {showAddMissingCreator
                    ? "Try a different spelling or handle, or add the creator by profile link."
                    : "Try widening the follower range, removing a category, or clearing some filters."}
                </p>
              </div>
              <AddMissingCreatorEmptyState
                visible={showAddMissingCreator}
                className="mt-1"
                onSuccess={onMissingCreatorAdded}
                onEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
                onCreatorUpdated={onMissingCreatorUpdated}
              />
            </div>
          )
        ) : (
          <>
            <CreatorResultGridHeader variant="search" sort={sort} onSortChange={onSortChange} />
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
                      rank={item.rank}
                      selected={selectedIds.has(item.creator.unified_id)}
                      platformFilter={platformFilter}
                      onToggleSelect={onToggleSelect}
                      onOpenCreator={onOpenCreator}
                      onAddToList={onAddToList}
                      onRefreshMetrics={onRefreshMetrics}
                      onStopRefresh={onStopRefresh}
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
