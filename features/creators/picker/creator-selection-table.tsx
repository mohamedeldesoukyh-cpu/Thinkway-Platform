"use client";

import { CheckIcon, Loader2Icon, RotateCwIcon, SearchIcon, SearchXIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DiscoverySearchExactListSkeleton } from "@/features/discovery/components/design-system";
import {
  DiscoveryCreatorExactHeader,
  DiscoveryCreatorExactRow,
} from "@/features/discovery/components/discovery-creator-exact-row";
import { AddMissingCreatorEmptyState } from "@/features/discovery/components/add-missing-creator-dialog";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import type { CreatorCheckboxState, CreatorRowMeta } from "./creator-selection-types";
import { CreatorPickerPanelRow } from "./creator-picker-panel-row";

type Props = {
  creators: UnifiedCreatorResult[];
  selectedIds: Set<string>;
  onToggle: (creator: UnifiedCreatorResult) => void;
  onToggleSelectAll?: () => void;
  selectAllState?: CreatorCheckboxState;
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  existingKeys?: Set<string>;
  isRowDisabled?: (creator: UnifiedCreatorResult) => boolean;
  disabledBadge?: (creator: UnifiedCreatorResult) => string | null;
  className?: string;
  showHeader?: boolean;
  total?: number;
  loadMoreRef?: (node: HTMLDivElement | null) => void;
  hasMore?: boolean;
  skeletonCount?: number;
  variant?: "compact" | "list" | "panel" | "exact";
  onSelectAllVisible?: () => void;
  selectAllLabel?: string;
  showAddMissingCreator?: boolean;
  onMissingCreatorAdded?: (creator: UnifiedCreatorResult) => void;
  onMissingCreatorEnrichmentStatusChange?: (
    unifiedId: string,
    status: CreatorEnrichmentStatus
  ) => void;
  onMissingCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

function toRowMeta(
  creator: UnifiedCreatorResult,
  existingKeys?: Set<string>,
  isRowDisabled?: (creator: UnifiedCreatorResult) => boolean,
  disabledBadge?: (creator: UnifiedCreatorResult) => string | null
): CreatorRowMeta {
  const onList =
    existingKeys != null &&
    [
      creator.unified_id,
      creator.influencer_id ? `inf:${creator.influencer_id}` : null,
      creator.discovered_profile_id ? `dis:${creator.discovered_profile_id}` : null,
    ]
      .filter(Boolean)
      .some((key) => existingKeys.has(key!));
  const customDisabled = isRowDisabled?.(creator) ?? false;
  const badge =
    disabledBadge?.(creator) ??
    (onList ? "On list" : customDisabled ? "Not addable" : null);

  return {
    id: creator.unified_id,
    label: creator.display_name,
    sublabel: creator.display_name,
    metric:
      creator.metrics.followers.value != null
        ? Intl.NumberFormat().format(creator.metrics.followers.value)
        : undefined,
    disabled: onList || customDisabled,
    disabledBadge: badge ?? undefined,
    creator,
  };
}

function ExactSelectionRow({
  creator,
  row,
  checked,
  onToggle,
  showFeed,
}: {
  creator: UnifiedCreatorResult;
  row: CreatorRowMeta;
  checked: boolean;
  onToggle: () => void;
  showFeed: boolean;
}) {
  const disabled = row.disabled;

  return (
    <DiscoveryCreatorExactRow
      creator={creator}
      selected={checked}
      selectable={!disabled}
      showFeed={showFeed}
      rowBehavior="toggle-select"
      onToggleSelect={disabled ? () => undefined : onToggle}
      onOpenCreator={disabled ? () => undefined : onToggle}
      className={cn(disabled && "pointer-events-none opacity-60")}
      meta={
        row.disabledBadge ? (
          <Badge
            variant={row.disabledBadge === "On list" ? "secondary" : "outline"}
            className="gap-1"
          >
            {row.disabledBadge === "On list" ? <CheckIcon className="size-3" /> : null}
            {row.disabledBadge}
          </Badge>
        ) : null
      }
    />
  );
}

function resolveShowFeed(variant: Props["variant"]): boolean {
  return variant === "list" || variant === "exact";
}

function PanelSelectionSkeleton({ count }: { count: number }) {
  return (
    <div className="creator-picker-panel-list space-y-2 px-3 py-2">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-[#eaedf4] bg-white p-2.5"
        >
          <div className="flex items-start gap-2">
            <div className="mt-2.5 size-4 shrink-0 animate-pulse rounded bg-muted" />
            <div className="size-[52px] shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="ml-[26px] mt-2 h-14 animate-pulse rounded-[10px] bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function CreatorSelectionTable({
  creators,
  selectedIds,
  onToggle,
  onToggleSelectAll,
  selectAllState = false,
  loading,
  loadingMore,
  error,
  onRetry,
  emptyMessage = "No creators found. Try a different search or filter.",
  existingKeys,
  isRowDisabled,
  disabledBadge,
  className,
  showHeader = true,
  total,
  loadMoreRef,
  hasMore,
  skeletonCount = 4,
  variant = "compact",
  onSelectAllVisible,
  selectAllLabel = "Select all",
  showAddMissingCreator = false,
  onMissingCreatorAdded,
  onMissingCreatorEnrichmentStatusChange,
  onMissingCreatorUpdated,
}: Props) {
  const resultCount = total ?? creators.length;
  const isPanel = variant === "panel";
  const showFeed = resolveShowFeed(variant);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {showHeader && isPanel ? (
        <div className="creator-picker-results-bar flex shrink-0 items-center justify-between px-4 pb-2 pt-2.5">
          <div className="flex items-center gap-1.5">
            <div className="flex size-[18px] items-center justify-center rounded-full border border-border bg-muted text-[9px] font-bold text-muted-foreground">
              {resultCount > 99 ? "99+" : resultCount}
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {loading && creators.length === 0
                ? "Searching…"
                : `${resultCount.toLocaleString()} ${resultCount === 1 ? "result" : "results"}`}
            </span>
          </div>
          {onSelectAllVisible ? (
            <button
              type="button"
              onClick={onSelectAllVisible}
              disabled={creators.length === 0}
              className="border-0 bg-transparent p-0 text-[11px] font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectAllLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          !isPanel && "overflow-x-auto",
          isPanel && "scrollbar-thin"
        )}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <SearchXIcon className="size-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            {onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
                <RotateCwIcon className="size-3.5" />
                Retry
              </Button>
            ) : null}
          </div>
        ) : loading && creators.length === 0 ? (
          isPanel ? (
            <PanelSelectionSkeleton count={skeletonCount} />
          ) : (
            <DiscoverySearchExactListSkeleton rows={skeletonCount} />
          )
        ) : creators.length === 0 ? (
          isPanel ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-3.5 flex size-12 items-center justify-center rounded-xl border border-border bg-muted">
                <SearchIcon className="size-[22px] text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-foreground">No creators found</p>
              <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
                Try a different search term or platform filter.
              </p>
              <AddMissingCreatorEmptyState
                visible={showAddMissingCreator}
                className="mt-3"
                onSuccess={onMissingCreatorAdded}
                onEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
                onCreatorUpdated={onMissingCreatorUpdated}
              />
            </div>
          ) : (
            <div className="space-y-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
              <AddMissingCreatorEmptyState
                visible={showAddMissingCreator}
                onSuccess={onMissingCreatorAdded}
                onEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
                onCreatorUpdated={onMissingCreatorUpdated}
              />
            </div>
          )
        ) : isPanel ? (
          <div className="creator-picker-panel-list space-y-2 px-3 py-2">
            {creators.map((creator) => {
              const row = toRowMeta(creator, existingKeys, isRowDisabled, disabledBadge);
              const checked = selectedIds.has(creator.unified_id);
              return (
                <CreatorPickerPanelRow
                  key={creator.unified_id}
                  creator={creator}
                  row={row}
                  checked={checked}
                  onToggle={() => onToggle(creator)}
                />
              );
            })}
          </div>
        ) : (
          <div className="discovery-search-exact-root min-w-[960px]">
            {!isPanel && showHeader ? (
              <DiscoveryCreatorExactHeader
                total={resultCount}
                allSelected={selectAllState}
                hasCreators={creators.length > 0}
                onToggleSelectAll={onToggleSelectAll ?? (() => undefined)}
                showSelectAll={Boolean(onToggleSelectAll)}
              />
            ) : null}
            <div className="discovery-search-exact-scroll">
              {creators.map((creator) => {
                const row = toRowMeta(creator, existingKeys, isRowDisabled, disabledBadge);
                const checked = selectedIds.has(creator.unified_id);
                return (
                  <ExactSelectionRow
                    key={creator.unified_id}
                    creator={creator}
                    row={row}
                    checked={checked}
                    showFeed={showFeed}
                    onToggle={() => onToggle(creator)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {loadMoreRef ? <div ref={loadMoreRef} className="h-8" aria-hidden /> : null}
        {loadingMore ? (
          <div className="flex justify-center py-3">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {hasMore === false && creators.length > 0 && !error ? (
          <p className="py-2 text-center text-[10px] text-muted-foreground">End of results</p>
        ) : null}
      </div>
    </div>
  );
}

/** Static list selection for quotation import tabs (non-browse). */
export function CreatorStaticSelectionList({
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  loading,
  emptyMessage = "No creators available.",
  idKey = "id" as const,
  labelKey = "label" as const,
}: {
  items: Array<{ id: string; label: string }>;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  idKey?: "id";
  labelKey?: "label";
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading…
      </p>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      {onSelectAll ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{items.length} creators</p>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onSelectAll}>
            Select all
          </Button>
        </div>
      ) : null}
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
        {items.map((item) => (
          <label
            key={item[idKey]}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
          >
            <Checkbox
              checked={selectedIds.has(item[idKey])}
              onCheckedChange={() => onToggle(item[idKey])}
            />
            <span className="truncate text-sm">{item[labelKey]}</span>
          </label>
        ))}
      </div>
    </>
  );
}
