"use client";

import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import { CountryFlagBadge } from "@/components/creator/country-flag-badge";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { filterPlatformsForDisplay } from "@/lib/creators/creator-centric";
import { creatorStoredCategoriesForDisplay } from "@/lib/creators/category-filter";
import {
  brandSafetyMeta,
  formatEngagementRate,
  normalizeCountryCode,
} from "@/features/discovery/components/creator-search/creator-search-utils";
import {
  InterestChips,
  PlatformCell,
} from "@/features/discovery/components/creator-result-row";
import { EnrichmentStatusBadge } from "@/features/discovery/enrichment/components/enrichment-status-badge";
import {
  isEnrichmentInProgress,
  resolveCreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import { PlatformMetricStack } from "@/features/discovery/components/platform-metric-stack";
import { cn } from "@/lib/utils";
import type { ShortlistItemStatus } from "@/types/database";
import { UsersIcon } from "lucide-react";

import { ShortlistItemStatusBadge } from "./shortlist-badges";
import { ShortlistDetailCheckbox } from "./shortlist-detail-primitives";

type ShortlistRowItem = {
  item_id: string;
  item_status: ShortlistItemStatus;
  creator: UnifiedCreatorResult | null;
};

type Props = {
  items: ShortlistRowItem[];
  selectedIds: Set<string>;
  selectable: boolean;
  allSelected: boolean;
  indeterminate: boolean;
  editable: boolean;
  busy?: boolean;
  onToggleSelect: (itemId: string) => void;
  onToggleSelectAll: () => void;
  onRemove: (itemId: string) => void;
  onAddToQuotation: (itemId: string) => void;
};

const TH_CLASS =
  "whitespace-nowrap border-b border-border bg-muted/50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground";
const TD_CLASS =
  "border-b border-border px-4 py-3.5 align-middle text-xs text-muted-foreground";
const ENRICHING_ROW_CLASS =
  "bg-sky-500/[0.07] ring-1 ring-inset ring-sky-500/25 hover:bg-sky-500/10";

function resolveDisplayEngagementRate(
  creator: UnifiedCreatorResult,
  displayPlatforms: UnifiedCreatorResult["platforms"]
): string {
  if (displayPlatforms.length === 1) {
    return formatEngagementRate(displayPlatforms[0]?.engagement_rate ?? null);
  }
  return formatEngagementRate(creator.metrics.engagement_rate.value);
}

function RowActions({
  editable,
  busy,
  onAddToQuotation,
  onRemove,
}: {
  editable: boolean;
  busy?: boolean;
  onAddToQuotation: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        onClick={onAddToQuotation}
        disabled={busy}
      >
        Add to quotation
      </button>
      <span className="h-3 w-px bg-border" aria-hidden />
      {editable ? (
        <button
          type="button"
          className="text-[11px] font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
          onClick={onRemove}
          disabled={busy}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

function CreatorDataRow({
  item,
  rank,
  selected,
  selectable,
  editable,
  busy,
  onToggleSelect,
  onRemove,
  onAddToQuotation,
}: {
  item: ShortlistRowItem;
  rank: number;
  selected: boolean;
  selectable: boolean;
  editable: boolean;
  busy?: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onAddToQuotation: () => void;
}) {
  const creator = item.creator!;
  const source = creatorProfileSourceFromUnified(creator);
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms);
  const avgEr = resolveDisplayEngagementRate(creator, displayPlatforms);
  const hasCountryCode = Boolean(normalizeCountryCode(creator.country_code));
  const safety = brandSafetyMeta(creator.authenticity_score);
  const enrichmentStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
  const enriching = isEnrichmentInProgress(enrichmentStatus);
  return (
    <tr
      className={cn(
        "group cursor-pointer transition-colors hover:bg-muted/40",
        enriching && ENRICHING_ROW_CLASS,
        selected && !enriching && "bg-primary/5 hover:bg-primary/10",
        selected && enriching && "bg-sky-500/10 hover:bg-sky-500/[0.12]"
      )}
      onClick={() => selectable && onToggleSelect()}
    >
      <td className={cn(TD_CLASS, "w-9")}>
        {selectable ? (
          <ShortlistDetailCheckbox
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${source.displayName}`}
          />
        ) : null}
      </td>
      <td className={cn(TD_CLASS, "w-7 tabular-nums text-muted-foreground")}>{rank}</td>
      <td className={cn(TD_CLASS, "min-w-[200px]")}>
        <CreatorProfileLink
          source={source}
          size="sm"
          avatarBadge="country"
          showPlatformBadge={false}
          linkName={false}
        />
      </td>
      <td className={TD_CLASS}>
        <PlatformCell creator={creator} />
      </td>
      <td className={cn(TD_CLASS, "text-right tabular-nums")}>
        <PlatformMetricStack platforms={displayPlatforms} metric="followers" align="right" />
      </td>
      <td className={TD_CLASS}>
        <div className="flex items-center gap-1">
          {hasCountryCode ? (
            <CountryFlagBadge countryCode={creator.country_code} size="inline" />
          ) : null}
          <span>{creator.country_code ?? "—"}</span>
        </div>
      </td>
      <td className={cn(TD_CLASS, "min-w-[140px] max-w-[200px]")}>
        <InterestChips interests={creatorStoredCategoriesForDisplay(creator).slice(0, 3)} />
      </td>
      <td className={cn(TD_CLASS, "text-right font-semibold tabular-nums text-foreground")}>
        {avgEr}
      </td>
      <td className={cn(TD_CLASS, "text-[11px] font-medium", safety.className)}>
        {safety.label}
      </td>
      <td className={cn(TD_CLASS, "min-w-[108px] whitespace-nowrap")}>
        <EnrichmentStatusBadge status={enrichmentStatus} className="text-xs font-semibold" />
      </td>
      <td className={TD_CLASS}>
        <ShortlistItemStatusBadge status={item.item_status} variant="table" />
      </td>
      <td className={cn(TD_CLASS, "w-0 whitespace-nowrap")}>
        <RowActions
          editable={editable}
          busy={busy}
          onAddToQuotation={onAddToQuotation}
          onRemove={onRemove}
        />
      </td>
    </tr>
  );
}

function UnknownCreatorRow({
  item,
  rank,
  selected,
  selectable,
  editable,
  busy,
  onToggleSelect,
  onRemove,
  onAddToQuotation,
}: {
  item: ShortlistRowItem;
  rank: number;
  selected: boolean;
  selectable: boolean;
  editable: boolean;
  busy?: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onAddToQuotation: () => void;
}) {
  return (
    <tr
      className={cn(
        "group cursor-pointer transition-colors hover:bg-muted/40",
        selected && "bg-primary/5 hover:bg-primary/10"
      )}
      onClick={() => selectable && onToggleSelect()}
    >
      <td className={cn(TD_CLASS, "w-9")}>
        {selectable ? (
          <ShortlistDetailCheckbox
            checked={selected}
            onChange={onToggleSelect}
            aria-label="Select unknown creator"
          />
        ) : null}
      </td>
      <td className={cn(TD_CLASS, "w-7 tabular-nums text-muted-foreground")}>{rank}</td>
      <td className={cn(TD_CLASS, "min-w-[180px]")}>
        <CreatorProfileLink
          source={{
            displayName: "Unknown creator",
            avatarUrl: null,
            handle: "Profile not resolved",
          }}
          size="sm"
          avatarBadge="country"
          showPlatformBadge={false}
          linkName={false}
        />
      </td>
      <td className={TD_CLASS}>—</td>
      <td className={TD_CLASS}>—</td>
      <td className={TD_CLASS}>—</td>
      <td className={TD_CLASS}>—</td>
      <td className={TD_CLASS}>—</td>
      <td className={TD_CLASS}>—</td>
      <td className={TD_CLASS}>
        <span className="text-[11px] text-muted-foreground/50">—</span>
      </td>
      <td className={TD_CLASS}>
        <ShortlistItemStatusBadge status={item.item_status} variant="table" />
      </td>
      <td className={cn(TD_CLASS, "w-0 whitespace-nowrap")}>
        <RowActions
          editable={editable}
          busy={busy}
          onAddToQuotation={onAddToQuotation}
          onRemove={onRemove}
        />
      </td>
    </tr>
  );
}

export function ShortlistCreatorList({
  items,
  selectedIds,
  selectable,
  allSelected,
  indeterminate,
  editable,
  busy,
  onToggleSelect,
  onToggleSelectAll,
  onRemove,
  onAddToQuotation,
}: Props) {
  return (
    <div className="overflow-x-auto px-1 pb-1">
      <table className="w-full min-w-[1080px] border-collapse [&_tbody_tr:last-child_td]:border-b-0">
        <thead>
          <tr>
            <th className={cn(TH_CLASS, "w-9")}>
              {selectable ? (
                <ShortlistDetailCheckbox
                  checked={allSelected}
                  indeterminate={indeterminate}
                  onChange={onToggleSelectAll}
                  aria-label="Select all creators"
                />
              ) : null}
            </th>
            <th className={cn(TH_CLASS, "w-7")}>#</th>
            <th className={TH_CLASS}>Creator</th>
            <th className={TH_CLASS}>Platform</th>
            <th className={cn(TH_CLASS, "text-right")}>Followers</th>
            <th className={TH_CLASS}>Country</th>
            <th className={TH_CLASS}>Audience interests</th>
            <th className={cn(TH_CLASS, "text-right")}>Avg ER</th>
            <th className={TH_CLASS}>Brand safety</th>
            <th className={TH_CLASS}>Sync</th>
            <th className={TH_CLASS}>Status</th>
            <th className={cn(TH_CLASS, "w-0")} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isSelected = selectedIds.has(item.item_id);
            const common = {
              item,
              rank: index + 1,
              selected: isSelected,
              selectable,
              editable,
              busy,
              onToggleSelect: () => onToggleSelect(item.item_id),
              onRemove: () => onRemove(item.item_id),
              onAddToQuotation: () => onAddToQuotation(item.item_id),
            };

            if (!item.creator) {
              return <UnknownCreatorRow key={item.item_id} {...common} />;
            }

            return <CreatorDataRow key={item.item_id} {...common} />;
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ShortlistCreatorEmptyState({
  editable,
  onAddCreators,
}: {
  editable: boolean;
  onAddCreators: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
      <div className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-muted/50">
        <UsersIcon className="size-[18px] text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-semibold text-foreground">No creators yet</p>
      <p className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground">
        {editable
          ? "Click “Add creators” to search and build this shortlist."
          : "This shortlist is locked in its current status."}
      </p>
      {editable ? (
        <button
          type="button"
          onClick={onAddCreators}
          className="mt-1 inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          Add creators
        </button>
      ) : null}
    </div>
  );
}
