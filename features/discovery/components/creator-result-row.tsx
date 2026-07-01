"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { memo, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import { CountryFlagBadge } from "@/components/creator/country-flag-badge";
import { EnrichmentStatusBadge } from "@/features/discovery/enrichment/components/enrichment-status-badge";
import { resolveCreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";
import { DiscoveryCreatorActionsMenu } from "@/features/discovery/components/discovery-creator-actions-menu";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  audienceInterestListFromCreator,
  filterPlatformsForDisplay,
} from "@/lib/creators/creator-centric";
import { resolvePrimaryProfileUrl } from "@/lib/discovery/profile-url";
import { cn } from "@/lib/utils";

import {
  applyCreatorSearchHeaderSort,
  audienceCountryLabel,
  brandSafetyMeta,
  formatEngagementRate,
  normalizeCountryCode,
  thinkwayAiScore,
} from "./creator-search/creator-search-utils";
import type {
  CreatorSearchSortField,
  CreatorSearchSortState,
} from "./creator-search/creator-search-types";
import {
  PlatformMetricStack,
  PlatformMetricsMobileBlock,
} from "./platform-metric-stack";

export const CREATOR_SEARCH_GRID_TEMPLATE =
  "40px minmax(0,1.7fr) 104px 92px 84px minmax(0,1.4fr) 80px 92px 108px 96px 88px 80px";
export const CREATOR_SHORTLIST_GRID_TEMPLATE =
  "40px minmax(0,1.7fr) 104px 92px 84px minmax(0,1.4fr) 80px 92px 108px 96px";
export const CREATOR_ROW_MIN_WIDTH = "md:min-w-[1268px]";
export const CREATOR_SHORTLIST_MIN_WIDTH = "md:min-w-[1060px]";

/** Single ER for a row — filtered platform when one match, else creator default metrics. */
function resolveDisplayEngagementRate(
  creator: UnifiedCreatorResult,
  displayPlatforms: UnifiedCreatorResult["platforms"]
): string {
  if (displayPlatforms.length === 1) {
    return formatEngagementRate(displayPlatforms[0]?.engagement_rate ?? null);
  }
  return formatEngagementRate(creator.metrics.engagement_rate.value);
}

export function InterestChips({ interests }: { interests: string[] }) {
  if (interests.length === 0) {
    return <span className="text-[11px] text-muted-foreground/60">No interests tagged</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {interests.map((interest) => (
        <span
          key={interest}
          className="truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
        >
          {interest}
        </span>
      ))}
    </div>
  );
}

export function RelevanceScore({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const rounded = Math.round(score);
  const bars = Math.max(1, Math.min(4, Math.ceil((rounded / 100) * 4)));
  return (
    <div className="flex items-center gap-1.5" title={`Thinkway AI relevance ${rounded}`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-0.5 rounded-full", i < bars ? "bg-primary" : "bg-primary/20")}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-primary">{rounded}</span>
    </div>
  );
}

export function PlatformCell({
  creator,
  platformFilter,
}: {
  creator: UnifiedCreatorResult;
  platformFilter?: string[];
}) {
  const platforms = filterPlatformsForDisplay(creator.platforms, platformFilter);
  if (platforms.length === 0) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" title="Linked platforms">
      {platforms.map((platform) => (
        <PlatformIcon
          key={platform.id}
          platform={platform.platform}
          size="xs"
          className="size-4 shrink-0 rounded-full"
        />
      ))}
    </div>
  );
}

function SelectCell({
  rank,
  selected,
  displayName,
  onToggleSelect,
}: {
  rank: number;
  selected: boolean;
  displayName: string;
  onToggleSelect: () => void;
}) {
  return (
    <div className="relative flex w-5 shrink-0 items-center justify-center md:w-auto">
      {!selected ? (
        <span className="text-[11px] tabular-nums text-muted-foreground/70 group-hover:opacity-0">
          {rank}
        </span>
      ) : null}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={`${selected ? "Deselect" : "Select"} ${displayName}`}
        />
      </span>
    </div>
  );
}

export type CreatorResultRowProps = {
  creator: UnifiedCreatorResult;
  rank: number;
  selected: boolean;
  variant?: "search" | "shortlist";
  onToggleSelect: () => void;
  onOpenCreator?: () => void;
  onAddToList?: () => void;
  onRefreshMetrics?: (platformAccountId?: string | null) => void;
  onStopRefresh?: () => void;
  addLabel?: string;
  statusBadge?: ReactNode;
  actions?: ReactNode;
  className?: string;
  workerOfflineHint?: boolean;
  /** When set, metric columns show only matching platform account data. */
  platformFilter?: string[];
};

/** Shared Discovery creator row — used by Search and Shortlist workspaces. */
export const CreatorResultRow = memo(function CreatorResultRow({
  creator,
  rank,
  selected,
  variant = "search",
  onToggleSelect,
  onOpenCreator,
  onAddToList,
  onRefreshMetrics,
  onStopRefresh,
  addLabel,
  statusBadge,
  actions,
  className,
  workerOfflineHint,
  platformFilter,
}: CreatorResultRowProps) {
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms, platformFilter);
  const avgEr = resolveDisplayEngagementRate(creator, displayPlatforms);
  const profileUrl = resolvePrimaryProfileUrl(creator.platforms);
  const displayCountry = audienceCountryLabel(creator);
  const hasCountryCode = Boolean(normalizeCountryCode(displayCountry));
  const audienceInterests = audienceInterestListFromCreator(creator);
  const safety = brandSafetyMeta(creator.authenticity_score);
  const aiScore = thinkwayAiScore(creator);
  const enrichmentStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
  const isShortlist = variant === "shortlist";
  const gridTemplate = isShortlist ? CREATOR_SHORTLIST_GRID_TEMPLATE : CREATOR_SEARCH_GRID_TEMPLATE;
  const minWidth = isShortlist ? CREATOR_SHORTLIST_MIN_WIDTH : CREATOR_ROW_MIN_WIDTH;

  const handleOpen = onOpenCreator ?? (() => undefined);
  const actionNode =
    actions ??
    (onOpenCreator || onAddToList || onRefreshMetrics || onStopRefresh ? (
      <DiscoveryCreatorActionsMenu
        creator={creator}
        profileUrl={profileUrl}
        selected={selected}
        onOpenCreator={handleOpen}
        onAddToList={onAddToList}
        onToggleSelect={onToggleSelect}
        onRefreshMetrics={onRefreshMetrics}
        onStopRefresh={onStopRefresh}
        addLabel={addLabel}
      />
    ) : null);

  return (
    <div
      role={onOpenCreator ? "button" : undefined}
      tabIndex={onOpenCreator ? 0 : undefined}
      onClick={onOpenCreator ? handleOpen : undefined}
      onKeyDown={
        onOpenCreator
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpen();
              }
            }
          : undefined
      }
      className={cn(
        "group border-b border-border transition-colors",
        onOpenCreator && "cursor-pointer hover:bg-muted/50",
        selected && "bg-primary/[0.06]",
        className
      )}
    >
      <div
        className={cn("hidden items-start gap-3 px-5 py-2.5 md:grid", minWidth)}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <SelectCell
          rank={rank}
          selected={selected}
          displayName={creator.display_name}
          onToggleSelect={onToggleSelect}
        />
        <CreatorProfileLink
          source={creatorProfileSourceFromUnified(creator)}
          size="lg"
          avatarBadge="country"
          showExternalIcon
          linkName={!onOpenCreator}
          stopPropagation
        />
        <PlatformCell creator={creator} platformFilter={platformFilter} />
        <PlatformMetricStack platforms={displayPlatforms} metric="followers" align="right" />
        <div className="flex items-center gap-1 self-center text-[12px] text-muted-foreground">
          {hasCountryCode ? <CountryFlagBadge countryCode={displayCountry} size="inline" /> : null}
          <span>{displayCountry}</span>
        </div>
        <div className="min-w-0 self-center">
          <InterestChips interests={audienceInterests.slice(0, 3)} />
        </div>
        <div className="self-center text-right text-[12px] font-semibold tabular-nums text-foreground">
          {avgEr}
        </div>
        {!isShortlist ? (
          <>
            <PlatformMetricStack platforms={displayPlatforms} metric="avg_views" align="right" />
            <div className="self-center">
              <RelevanceScore score={aiScore} />
            </div>
          </>
        ) : null}
        <div className={cn("self-center text-[11px] font-medium", safety.className)}>{safety.label}</div>
        {!isShortlist ? (
          <div className="flex justify-end self-center">
            <EnrichmentStatusBadge
              status={enrichmentStatus}
              workerOfflineHint={workerOfflineHint}
              className="text-[10px]"
            />
          </div>
        ) : null}
        {isShortlist ? <div className="min-w-0 self-center">{statusBadge}</div> : null}
        {!isShortlist ? <div className="self-center">{actionNode}</div> : null}
        {isShortlist ? <div className="self-center">{actionNode}</div> : null}
      </div>

      <div className="flex items-start gap-3 px-4 py-3 md:hidden">
        <SelectCell
          rank={rank}
          selected={selected}
          displayName={creator.display_name}
          onToggleSelect={onToggleSelect}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CreatorProfileLink
              source={creatorProfileSourceFromUnified(creator)}
              size="md"
              avatarBadge="country"
              showExternalIcon
              linkName={!onOpenCreator}
              stopPropagation
            />
            {actionNode}
          </div>
          <PlatformMetricsMobileBlock platforms={displayPlatforms} avgEr={avgEr} />
          {hasCountryCode || displayCountry !== "—" ? (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {hasCountryCode ? (
                <CountryFlagBadge countryCode={displayCountry} size="inline" />
              ) : null}
              {displayCountry !== "—" ? displayCountry : ""}
            </div>
          ) : null}
          <InterestChips interests={audienceInterests.slice(0, 4)} />
          <div className="flex items-center justify-between gap-3">
            {!isShortlist ? <RelevanceScore score={aiScore} /> : statusBadge}
            <div className="flex items-center gap-2">
              {!isShortlist ? (
                <EnrichmentStatusBadge
              status={enrichmentStatus}
              workerOfflineHint={workerOfflineHint}
              className="text-[10px]"
            />
              ) : null}
              <span className={cn("text-[10px] font-medium", safety.className)}>
                {safety.label} safety
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

type HeaderColumn = {
  key: string;
  label: string;
  align?: "right";
  srOnly?: boolean;
  sortField?: CreatorSearchSortField;
};

const SEARCH_HEADER_COLUMNS: HeaderColumn[] = [
  { key: "rank", label: "#" },
  { key: "creator", label: "Creator", sortField: "name" },
  { key: "platform", label: "Platform" },
  { key: "followers", label: "Followers", align: "right", sortField: "followers" },
  { key: "country", label: "Country" },
  { key: "categories", label: "Categories" },
  { key: "er", label: "Avg ER", align: "right", sortField: "engagement" },
  { key: "views", label: "Avg views", align: "right", sortField: "views" },
  { key: "relevance", label: "Relevance", sortField: "thinkway" },
  { key: "safety", label: "Brand safety" },
  { key: "sync", label: "Sync", sortField: "last_synced" },
  { key: "actions", label: "Actions", align: "right", srOnly: true },
];

const SHORTLIST_HEADER_COLUMNS: HeaderColumn[] = [
  { key: "select", label: "#" },
  { key: "creator", label: "Creator" },
  { key: "platform", label: "Platform" },
  { key: "followers", label: "Followers", align: "right" },
  { key: "country", label: "Country" },
  { key: "interests", label: "Audience interests" },
  { key: "er", label: "Avg ER", align: "right" },
  { key: "safety", label: "Brand safety" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "right", srOnly: true },
];

export function CreatorResultGridHeader({
  variant = "search",
  sort,
  onSortChange,
}: {
  variant?: "search" | "shortlist";
  sort?: CreatorSearchSortState;
  onSortChange?: (sort: CreatorSearchSortState) => void;
}) {
  const columns = variant === "shortlist" ? SHORTLIST_HEADER_COLUMNS : SEARCH_HEADER_COLUMNS;
  const gridTemplate =
    variant === "shortlist" ? CREATOR_SHORTLIST_GRID_TEMPLATE : CREATOR_SEARCH_GRID_TEMPLATE;
  const minWidth = variant === "shortlist" ? CREATOR_SHORTLIST_MIN_WIDTH : CREATOR_ROW_MIN_WIDTH;

  return (
    <div
      role="row"
      className={cn(
        "sticky top-0 z-10 hidden items-center gap-3 border-b border-border bg-muted/60 px-5 py-2",
        "text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase md:grid",
        minWidth
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {columns.map((column) => {
        const isActive = column.sortField != null && sort?.field === column.sortField;
        const sortable =
          variant === "search" && column.sortField != null && sort != null && onSortChange != null;

        if (sortable) {
          return (
            <button
              key={column.key}
              type="button"
              role="columnheader"
              aria-sort={
                isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
              }
              onClick={() => onSortChange(applyCreatorSearchHeaderSort(sort, column.sortField!))}
              className={cn(
                "inline-flex min-w-0 items-center gap-0.5 truncate transition-colors hover:text-foreground",
                column.align === "right" && "justify-end text-right",
                isActive && "text-foreground"
              )}
            >
              <span className="truncate">{column.label}</span>
              {isActive ? (
                sort.direction === "asc" ? (
                  <ArrowUpIcon className="size-3 shrink-0" aria-hidden />
                ) : (
                  <ArrowDownIcon className="size-3 shrink-0" aria-hidden />
                )
              ) : null}
            </button>
          );
        }

        return (
          <div
            key={column.key}
            role="columnheader"
            className={cn("min-w-0 truncate", column.align === "right" && "text-right")}
          >
            {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
          </div>
        );
      })}
    </div>
  );
}
