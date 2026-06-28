"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2Icon, RotateCwIcon, SearchXIcon } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorCheckboxState } from "@/features/creators/picker/creator-selection-hooks";

import {
  CreatorResultGridHeader,
  CreatorResultRow,
} from "../creator-result-row";

const ROW_ESTIMATE = 76;

type Props = {
  creators: UnifiedCreatorResult[];
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
  onStopRefresh?: (creator: UnifiedCreatorResult) => void;
  onStopAllRefresh?: () => void;
  inFlightCount?: number;
  onRetry: () => void;
  loadMoreRef: (node: HTMLDivElement | null) => void;
};

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
  onStopRefresh,
  onStopAllRefresh,
  inFlightCount = 0,
  onRetry,
  loadMoreRef,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: creators.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 12,
  });

  const allSelected = resolveCreatorCheckboxState(
    creators.map((c) => c.unified_id),
    selectedIds
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 md:px-5">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleSelectAll}
          aria-label="Select all loaded creators"
          disabled={creators.length === 0}
        />
        <span className="text-[12px] font-medium text-muted-foreground">
          {loading && creators.length === 0
            ? "Searching…"
            : `${total.toLocaleString()} ${total === 1 ? "result" : "results"}`}
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
        ) : loading && creators.length === 0 ? (
          <div>
            <CreatorResultGridHeader variant="search" />
            {Array.from({ length: 8 }).map((_, i) => (
              <ResultSkeleton key={i} />
            ))}
          </div>
        ) : creators.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <SearchXIcon className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No creators match your filters</p>
              <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
                Try widening the follower range, removing a category, or clearing some filters.
              </p>
            </div>
          </div>
        ) : (
          <>
            <CreatorResultGridHeader variant="search" />
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const creator = creators[virtualRow.index];
                if (!creator) return null;
                return (
                  <div
                    key={creator.unified_id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <CreatorResultRow
                      creator={creator}
                      rank={virtualRow.index + 1}
                      selected={selectedIds.has(creator.unified_id)}
                      variant="search"
                      onToggleSelect={() => onToggleSelect(creator)}
                      onOpenCreator={() => onOpenCreator(creator)}
                      onAddToList={() => onAddToList(creator)}
                      onStopRefresh={
                        onStopRefresh ? () => onStopRefresh(creator) : undefined
                      }
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
        {!hasMore && creators.length > 0 && !error ? (
          <p className="py-3 text-center text-[10px] text-muted-foreground">End of results</p>
        ) : null}
      </div>
    </div>
  );
}
