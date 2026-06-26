"use client";

import { CheckIcon, Loader2Icon, RotateCwIcon, SearchXIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import type { CreatorCheckboxState, CreatorRowMeta } from "./creator-selection-types";

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
  /** When set, rows matching these keys render as disabled with optional badge. */
  existingKeys?: Set<string>;
  isRowDisabled?: (creator: UnifiedCreatorResult) => boolean;
  disabledBadge?: (creator: UnifiedCreatorResult) => string | null;
  className?: string;
  showHeader?: boolean;
  total?: number;
  loadMoreRef?: (node: HTMLDivElement | null) => void;
  hasMore?: boolean;
  skeletonCount?: number;
  variant?: "compact" | "list";
};

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Skeleton className="size-4 rounded" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

function toRowMeta(
  creator: UnifiedCreatorResult,
  existingKeys?: Set<string>,
  isRowDisabled?: (creator: UnifiedCreatorResult) => boolean,
  disabledBadge?: (creator: UnifiedCreatorResult) => string | null
): CreatorRowMeta {
  const platformInfo = creator.platforms[0];
  const onList =
    existingKeys != null &&
    [creator.unified_id, creator.influencer_id ? `inf:${creator.influencer_id}` : null, creator.discovered_profile_id ? `dis:${creator.discovered_profile_id}` : null]
      .filter(Boolean)
      .some((key) => existingKeys.has(key!));
  const customDisabled = isRowDisabled?.(creator) ?? false;
  const badge = disabledBadge?.(creator) ?? (onList ? "On list" : customDisabled ? "Not addable" : null);

  return {
    id: creator.unified_id,
    label: creator.display_name,
    sublabel: platformInfo
      ? `${platformInfo.platform} · @${platformInfo.handle}`
      : creator.source_type,
    metric:
      creator.metrics.followers.value != null
        ? Intl.NumberFormat().format(creator.metrics.followers.value)
        : undefined,
    disabled: onList || customDisabled,
    disabledBadge: badge ?? undefined,
    creator,
  };
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
  skeletonCount = 8,
  variant = "compact",
}: Props) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {showHeader ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
          {onToggleSelectAll ? (
            <Checkbox
              checked={selectAllState}
              onCheckedChange={onToggleSelectAll}
              aria-label="Select all visible creators"
              disabled={creators.length === 0}
            />
          ) : null}
          <span className="text-[12px] font-medium text-muted-foreground">
            {loading && creators.length === 0
              ? "Searching…"
              : `${(total ?? creators.length).toLocaleString()} ${(total ?? creators.length) === 1 ? "result" : "results"}`}
          </span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
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
          <div className="space-y-1 py-1">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : creators.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className={cn("space-y-1 p-1", variant === "list" && "p-0")}>
            {creators.map((creator) => {
              const row = toRowMeta(creator, existingKeys, isRowDisabled, disabledBadge);
              const checked = selectedIds.has(creator.unified_id);
              return (
                <li key={creator.unified_id}>
                  <CreatorSelectionRow
                    row={row}
                    checked={checked}
                    onToggle={() => onToggle(creator)}
                  />
                </li>
              );
            })}
          </ul>
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

function CreatorSelectionRow({
  row,
  checked,
  onToggle,
}: {
  row: CreatorRowMeta;
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = row.disabled;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-left transition",
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-border hover:bg-muted/50"
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={`Select ${row.label}`}
      />
      <div
        role={disabled ? undefined : "button"}
        tabIndex={disabled ? undefined : 0}
        aria-disabled={disabled || undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 text-left outline-none",
          !disabled && "cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-primary/25"
        )}
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
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.label}</p>
          {row.sublabel ? (
            <p className="truncate text-xs text-muted-foreground">{row.sublabel}</p>
          ) : null}
        </div>
        {row.metric ? (
          <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
            {row.metric}
          </span>
        ) : null}
        {row.disabledBadge ? (
          <Badge variant={row.disabledBadge === "On list" ? "secondary" : "outline"} className="gap-1">
            {row.disabledBadge === "On list" ? <CheckIcon className="size-3" /> : null}
            {row.disabledBadge}
          </Badge>
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
