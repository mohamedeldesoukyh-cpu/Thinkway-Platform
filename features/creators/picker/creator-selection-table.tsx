"use client";

import { CheckIcon, Loader2Icon, RotateCwIcon, SearchIcon, SearchXIcon } from "lucide-react";

import { CreatorProfileLink, creatorProfileSourceFromUnified } from "@/components/creator/creator-profile-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";
import { AddMissingCreatorEmptyState } from "@/features/discovery/components/add-missing-creator-dialog";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";

import { formatPanelFollowers } from "./creator-selection-format";
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
  variant?: "compact" | "list" | "panel";
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

function PanelRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-slate-50 px-4 py-[11px]">
      <Skeleton className="size-[18px] rounded-[5px]" />
      <Skeleton className="size-[38px] rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <Skeleton className="h-3.5 w-10" />
    </div>
  );
}

function primaryPlatformAccount(creator: UnifiedCreatorResult) {
  const platforms = sortPlatformsStable(creator.platforms);
  return (
    platforms.find((p) => p.id === creator.default_metrics_platform_account_id) ??
    platforms[0] ??
    null
  );
}

function formatPlatformSublabel(creator: UnifiedCreatorResult): string {
  const platforms = sortPlatformsStable(creator.platforms);
  if (platforms.length === 0) return creator.source_type;
  const primary = primaryPlatformAccount(creator);
  const platformNames = platforms.map((p) => platformLabel(p.platform)).join(", ");
  const handle = primary?.handle?.replace(/^@/, "") ?? "";
  return handle ? `${platformNames} · @${handle}` : platformNames;
}

function toRowMeta(
  creator: UnifiedCreatorResult,
  existingKeys?: Set<string>,
  isRowDisabled?: (creator: UnifiedCreatorResult) => boolean,
  disabledBadge?: (creator: UnifiedCreatorResult) => string | null
): CreatorRowMeta {
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
    sublabel: formatPlatformSublabel(creator),
    metric:
      creator.metrics.followers.value != null
        ? Intl.NumberFormat().format(creator.metrics.followers.value)
        : undefined,
    disabled: onList || customDisabled,
    disabledBadge: badge ?? undefined,
    creator,
  };
}

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

function panelPlatformMeta(creator: UnifiedCreatorResult): {
  platforms: UnifiedCreatorResult["platforms"];
  handle: string | null;
  followers: number | null;
} {
  const platforms = sortPlatformsStable(creator.platforms);
  const primary = primaryPlatformAccount(creator);
  const platformFollowers = platforms
    .map((p) => p.follower_count)
    .filter((value): value is number => value != null && value > 0);
  const followersFromPlatforms =
    platformFollowers.length > 0 ? Math.max(...platformFollowers) : null;

  return {
    platforms,
    handle: primary?.handle ?? null,
    followers: creator.metrics.followers.value ?? followersFromPlatforms,
  };
}

function formatHandle(handle: string | null): string {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
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
  onSelectAllVisible,
  selectAllLabel = "Select all",
  showAddMissingCreator = false,
  onMissingCreatorAdded,
  onMissingCreatorEnrichmentStatusChange,
  onMissingCreatorUpdated,
}: Props) {
  const resultCount = total ?? creators.length;
  const isPanel = variant === "panel";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {showHeader && isPanel ? (
        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-2.5">
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
      ) : showHeader ? (
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
              : `${resultCount.toLocaleString()} ${resultCount === 1 ? "result" : "results"}`}
          </span>
        </div>
      ) : null}

      <div className={cn("min-h-0 flex-1 overflow-y-auto", isPanel && "scrollbar-thin")}>
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
          <div className={cn(isPanel ? "" : "space-y-1 py-1")}>
            {Array.from({ length: skeletonCount }).map((_, i) =>
              isPanel ? <PanelRowSkeleton key={i} /> : <RowSkeleton key={i} />
            )}
          </div>
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
          <div>
            {creators.map((creator) => {
              const row = toRowMeta(creator, existingKeys, isRowDisabled, disabledBadge);
              const checked = selectedIds.has(creator.unified_id);
              return (
                <PanelSelectionRow
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
        {hasMore === false && creators.length > 0 && !error && !isPanel ? (
          <p className="py-2 text-center text-[10px] text-muted-foreground">End of results</p>
        ) : null}
      </div>
    </div>
  );
}

function PanelSelectionRow({
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
  const disabled = row.disabled;
  const source = creatorProfileSourceFromUnified(creator);
  const meta = panelPlatformMeta(creator);
  const handleLabel = formatHandle(meta.handle);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 border-b border-slate-50 px-4 py-[11px] text-left transition-colors",
        disabled && "cursor-not-allowed opacity-60",
        !disabled && checked && "bg-blue-50 hover:bg-blue-100",
        !disabled && !checked && "hover:bg-slate-50"
      )}
    >
      <span
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all",
          checked ? "border-blue-600 bg-blue-600" : "border-border bg-white"
        )}
        aria-hidden
      >
        <CheckIcon
          className={cn(
            "size-2.5 text-white transition-all",
            checked ? "scale-100 opacity-100" : "scale-75 opacity-0"
          )}
          strokeWidth={3}
        />
      </span>

      <CreatorProfileLink
        source={source}
        size="md"
        avatarBadge="country"
        showPlatformBadge={false}
        showName={false}
        showHandle={false}
        linkName={false}
        className="shrink-0"
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-foreground">{row.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {meta.platforms.length > 0 ? (
            <span
              className="flex shrink-0 items-center gap-0.5"
              title={meta.platforms.map((p) => platformLabel(p.platform)).join(", ")}
            >
              {meta.platforms.map((platform) => (
                <PlatformIcon
                  key={platform.id}
                  platform={platform.platform}
                  size="xs"
                  className="size-3.5 rounded-full"
                />
              ))}
            </span>
          ) : null}
          {handleLabel ? <span className="truncate">{handleLabel}</span> : null}
        </span>
      </span>

      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {formatPanelFollowers(meta.followers)}
      </span>

      {row.disabledBadge ? (
        <Badge variant={row.disabledBadge === "On list" ? "secondary" : "outline"} className="shrink-0 gap-1">
          {row.disabledBadge === "On list" ? <CheckIcon className="size-3" /> : null}
          {row.disabledBadge}
        </Badge>
      ) : null}
    </button>
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
