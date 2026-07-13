"use client";

import { useMemo, useState } from "react";
import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import { CountryFlagBadge } from "@/components/creator/country-flag-badge";
import { CreatorTierBadge } from "@/components/creator/creator-tier-badge";
import { resolveCreatorTierFromUnified } from "@/lib/creators/creator-tier";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { filterPlatformsForDisplay } from "@/lib/creators/creator-centric";
import { resolveDiscoveryCreatorDisplayCategories } from "@/lib/creators/creator-display-categories";
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
import { DeleteDiscoveryCreatorDialog } from "@/features/discovery/delete-creator/delete-discovery-creator-dialog";
import {
  isEnrichmentInProgress,
  resolveEnrichmentDisplayStatus,
} from "@/features/discovery/enrichment/status";
import { PlatformMetricStack } from "@/features/discovery/components/platform-metric-stack";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ShortlistCreatorQuotationRef } from "../types";
import type { ShortlistItemStatus } from "@/types/database";
import { ArrowDownIcon, ArrowUpIcon, MoreHorizontalIcon, UsersIcon } from "lucide-react";

import { ShortlistItemStatusBadge, ShortlistCreatorQuotedBadge } from "./shortlist-badges";
import { SHORTLIST_QUOTED_COLUMN_LABEL } from "../constants";
import { ShortlistDetailCheckbox } from "./shortlist-detail-primitives";
import {
  applyShortlistHeaderSort,
  sortShortlistCreators,
  type ShortlistCreatorSortField,
  type ShortlistCreatorSortState,
} from "../shortlist-creator-sort";

type ShortlistRowItem = {
  item_id: string;
  item_status: ShortlistItemStatus;
  creator: UnifiedCreatorResult | null;
  quotation_refs: ShortlistCreatorQuotationRef[];
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
  onCreatorDeleted?: () => void;
};

const TH_CLASS =
  "border-b border-border bg-muted/50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground";
const TD_CLASS = "border-b border-border px-4 py-3.5 align-middle text-xs text-muted-foreground";
const ENRICHING_ROW_CLASS =
  "bg-sky-500/[0.07] ring-1 ring-inset ring-sky-500/25 hover:bg-sky-500/10";

function SortableHeader({
  label,
  field,
  align,
  sort,
  onSortChange,
}: {
  label: string;
  field: ShortlistCreatorSortField;
  align?: "left" | "right";
  sort: ShortlistCreatorSortState | null;
  onSortChange: (next: ShortlistCreatorSortState) => void;
}) {
  const isActive = sort?.field === field;

  return (
    <th className={cn(TH_CLASS, align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSortChange(applyShortlistHeaderSort(sort, field))}
        aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
        className={cn(
          "inline-flex w-full min-w-0 items-center gap-0.5 transition-colors hover:text-foreground",
          align === "right" && "justify-end text-right",
          isActive && "text-foreground"
        )}
      >
        <span className="truncate">{label}</span>
        {isActive ? (
          sort.direction === "asc" ? (
            <ArrowUpIcon className="size-3 shrink-0" aria-hidden />
          ) : (
            <ArrowDownIcon className="size-3 shrink-0" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );
}

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
  visible,
  onAddToQuotation,
  onRemove,
  onDeleteCreator,
}: {
  editable: boolean;
  busy?: boolean;
  visible?: boolean;
  onAddToQuotation: () => void;
  onRemove: () => void;
  onDeleteCreator?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex justify-end opacity-0 transition-opacity group-hover:opacity-100",
        visible && "opacity-100"
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            disabled={busy}
            aria-label="Creator actions"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onAddToQuotation} disabled={busy}>
            Add to quotation
          </DropdownMenuItem>
          {onDeleteCreator ? (
            <DropdownMenuItem
              onSelect={onDeleteCreator}
              disabled={busy}
              className="text-red-600 focus:text-red-600"
            >
              Delete creator
            </DropdownMenuItem>
          ) : null}
          {editable ? (
            <>
              {onDeleteCreator ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                onSelect={onRemove}
                disabled={busy}
                className="text-red-600 focus:text-red-600"
              >
                Remove from shortlist
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
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
  onCreatorDeleted,
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
  onCreatorDeleted?: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const creator = item.creator!;
  const source = creatorProfileSourceFromUnified(creator);
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms);
  const avgEr = resolveDisplayEngagementRate(creator, displayPlatforms);
  const hasCountryCode = Boolean(normalizeCountryCode(creator.country_code));
  const safety = brandSafetyMeta(creator.authenticity_score);
  const enrichmentStatus = resolveEnrichmentDisplayStatus(
    creator.enrichment_status,
    creator
  );
  const enriching = isEnrichmentInProgress(enrichmentStatus);
  const tier = resolveCreatorTierFromUnified(creator);
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
      <td className={cn(TD_CLASS, "min-w-0 overflow-hidden")}>
        <CreatorProfileLink
          source={source}
          size="lg"
          avatarBadge="country"
          showPlatformBadge={false}
          linkName={false}
          nameClassName="truncate"
          className="min-w-0 max-w-full"
        />
      </td>
      <td className={TD_CLASS}>
        <PlatformCell creator={creator} />
      </td>
      <td className={cn(TD_CLASS, "text-right tabular-nums")}>
        <PlatformMetricStack platforms={displayPlatforms} metric="followers" align="right" />
      </td>
      <td className={cn(TD_CLASS, "min-w-[5.5rem]")}>
        <CreatorTierBadge tier={tier} />
      </td>
      <td className={TD_CLASS}>
        <div className="flex items-center gap-1">
          {hasCountryCode ? (
            <CountryFlagBadge countryCode={creator.country_code} size="inline" />
          ) : null}
          <span>{creator.country_code ?? "—"}</span>
        </div>
      </td>
      <td className={cn(TD_CLASS, "max-w-[9rem] overflow-hidden")}>
        <InterestChips
          interests={resolveDiscoveryCreatorDisplayCategories(creator)}
          variant="compact"
          maxVisible={2}
        />
      </td>
      <td className={cn(TD_CLASS, "text-right font-semibold tabular-nums text-foreground")}>
        {avgEr}
      </td>
      <td className={cn(TD_CLASS, "overflow-hidden text-[11px] font-medium", safety.className)}>
        <span className="block truncate" title={safety.label}>
          {safety.label}
        </span>
      </td>
      <td className={cn(TD_CLASS, "min-w-[108px] whitespace-nowrap")}>
        <EnrichmentStatusBadge status={enrichmentStatus} className="text-xs font-semibold" />
      </td>
      <td className={TD_CLASS}>
        <ShortlistItemStatusBadge status={item.item_status} variant="table" />
      </td>
      <td className={cn(TD_CLASS, "min-w-[7.5rem]")}>
        <ShortlistCreatorQuotedBadge refs={item.quotation_refs} variant="table" />
      </td>
      <td className={cn(TD_CLASS, "w-10 overflow-hidden p-2 text-right")}>
        <RowActions
          editable={editable}
          busy={busy}
          visible={selected}
          onAddToQuotation={onAddToQuotation}
          onRemove={onRemove}
          onDeleteCreator={
            creator.influencer_id ? () => setDeleteOpen(true) : undefined
          }
        />
        {creator.influencer_id ? (
          <DeleteDiscoveryCreatorDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            creator={creator}
            onDeleted={onCreatorDeleted}
          />
        ) : null}
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
          size="lg"
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
      <td className={TD_CLASS}>—</td>
      <td className={TD_CLASS}>
        <span className="text-[11px] text-muted-foreground/50">—</span>
      </td>
      <td className={TD_CLASS}>
        <ShortlistItemStatusBadge status={item.item_status} variant="table" />
      </td>
      <td className={cn(TD_CLASS, "min-w-[7.5rem]")}>
        <ShortlistCreatorQuotedBadge refs={item.quotation_refs} variant="table" />
      </td>
      <td className={cn(TD_CLASS, "w-10 overflow-hidden p-2 text-right")}>
        <RowActions
          editable={editable}
          busy={busy}
          visible={selected}
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
  onCreatorDeleted,
}: Props) {
  const [sort, setSort] = useState<ShortlistCreatorSortState | null>(null);
  const sortedItems = useMemo(() => sortShortlistCreators(items, sort), [items, sort]);

  return (
    <div className="w-full overflow-x-auto px-1 pb-1">
      <table className="w-full min-w-[1040px] table-fixed border-collapse [&_tbody_tr:last-child_td]:border-b-0">
        <colgroup>
          <col className="w-9" />
          <col className="w-7" />
          <col className="w-[13%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[6%]" />
          <col className="w-[6%]" />
          <col className="w-[10%]" />
          <col className="w-[5%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[6%]" />
          <col className="w-[8%]" />
          <col className="w-10" />
        </colgroup>
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
            <SortableHeader label="#" field="rank" sort={sort} onSortChange={setSort} />
            <SortableHeader label="Creator" field="creator" sort={sort} onSortChange={setSort} />
            <SortableHeader label="Platform" field="platform" sort={sort} onSortChange={setSort} />
            <SortableHeader
              label="Followers"
              field="followers"
              align="right"
              sort={sort}
              onSortChange={setSort}
            />
            <SortableHeader label="Tier" field="tier" sort={sort} onSortChange={setSort} />
            <SortableHeader label="Country" field="country" sort={sort} onSortChange={setSort} />
            <SortableHeader
              label="Audience interests"
              field="interests"
              sort={sort}
              onSortChange={setSort}
            />
            <SortableHeader
              label="Avg ER"
              field="engagement"
              align="right"
              sort={sort}
              onSortChange={setSort}
            />
            <SortableHeader
              label="Brand safety"
              field="brand_safety"
              sort={sort}
              onSortChange={setSort}
            />
            <SortableHeader label="Sync" field="sync" sort={sort} onSortChange={setSort} />
            <SortableHeader label="Status" field="status" sort={sort} onSortChange={setSort} />
            <SortableHeader
              label={SHORTLIST_QUOTED_COLUMN_LABEL}
              field="quoted"
              sort={sort}
              onSortChange={setSort}
            />
            <th className={cn(TH_CLASS, "w-10")} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, index) => {
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
              onCreatorDeleted,
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
