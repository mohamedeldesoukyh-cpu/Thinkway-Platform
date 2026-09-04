"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  DiscoveryCreatorExactHeader,
  DiscoveryCreatorExactRow,
} from "@/features/discovery/components/discovery-creator-exact-row";
import { DISCOVERY_GRID_MIN_W } from "@/features/discovery/components/design-system/discovery-suite-cols";
import {
  isEnrichmentInProgress,
  resolveCreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import { cn } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, Link2Icon, UsersIcon } from "lucide-react";

const SHORTLIST_GRID_MIN_W = DISCOVERY_GRID_MIN_W.shortlist ?? 1360;

import { SHORTLIST_QUOTED_COLUMN_LABEL } from "../constants";
import {
  isGroupPartiallyOrFullySelected,
  resolveGroupCheckboxState,
} from "../bulk-selection-policy";
import {
  applyShortlistHeaderSort,
  sortShortlistCreators,
  type ShortlistCreatorSortField,
  type ShortlistCreatorSortState,
} from "../shortlist-creator-sort";
import type { ShortlistCreatorItem } from "../types";
import {
  buildShortlistDisplayBlocks,
  type ShortlistDisplayBlock,
} from "../shortlist-collapse-groups";
import { ShortlistCollapseContentHeader } from "./shortlist-collapse-content-header";
import {
  isShortlistCreatorQuoted,
  ShortlistCreatorQuotedLabel,
} from "./shortlist-badges";
import {
  ShortlistCreatorQuotedCell,
  ShortlistCreatorStatusCell,
  ShortlistCreatorTierCell,
  shortlistCreatorSyncBorderClass,
} from "./shortlist-creator-meta-columns";

type ShortlistRowItem = Pick<
  ShortlistCreatorItem,
  "item_id" | "item_status" | "creator" | "quotation_refs"
>;

type Props = {
  items: ShortlistCreatorItem[];
  selectedIds: Set<string>;
  selectable: boolean;
  allSelected: boolean;
  indeterminate: boolean;
  onToggleSelect: (itemId: string) => void;
  onToggleSelectGroup?: (itemIds: string[]) => void;
  onToggleSelectAll: () => void;
  onOpenCreator?: (creator: UnifiedCreatorResult) => void;
};

function shortlistCreatorMetaHeaderColumns(
  sort: ShortlistCreatorSortState | null,
  onSortChange: (next: ShortlistCreatorSortState) => void
) {
  return {
    tier: (
      <SortableMetaLabel label="Tier" field="tier" sort={sort} onSortChange={onSortChange} />
    ),
    status: (
      <SortableMetaLabel label="Status" field="status" sort={sort} onSortChange={onSortChange} />
    ),
    quoted: (
      <SortableMetaLabel
        label={SHORTLIST_QUOTED_COLUMN_LABEL}
        field="quoted"
        sort={sort}
        onSortChange={onSortChange}
      />
    ),
  };
}

function shortlistCreatorMetaRowColumns(item: ShortlistRowItem) {
  return {
    tier: <ShortlistCreatorTierCell creator={item.creator} />,
    status: <ShortlistCreatorStatusCell itemStatus={item.item_status} />,
    quoted: <ShortlistCreatorQuotedCell quotationRefs={item.quotation_refs} />,
  };
}

function SortableMetaLabel({
  label,
  field,
  sort,
  onSortChange,
}: {
  label: string;
  field: ShortlistCreatorSortField;
  sort: ShortlistCreatorSortState | null;
  onSortChange: (next: ShortlistCreatorSortState) => void;
}) {
  const isActive = sort?.field === field;

  return (
    <button
      type="button"
      onClick={() => onSortChange(applyShortlistHeaderSort(sort, field))}
      aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "inline-flex min-w-0 items-center gap-0.5 text-left transition-colors hover:text-[#41495a]",
        isActive && "text-[#41495a]"
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
  );
}

function ShortlistCreatorRow({
  item,
  selected,
  selectable,
  onToggleSelect,
  onOpenCreator,
}: {
  item: ShortlistRowItem;
  selected: boolean;
  selectable: boolean;
  onToggleSelect: () => void;
  onOpenCreator?: (creator: UnifiedCreatorResult) => void;
}) {
  const creator = item.creator;

  if (!creator) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => selectable && onToggleSelect()}
        onKeyDown={(event) => {
          if (!selectable) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleSelect();
          }
        }}
        className={cn(
          "discovery-search-exact-row discovery-search-exact-row--with-meta",
          shortlistCreatorSyncBorderClass("never"),
          selected && "is-selected"
        )}
      >
        <div className="discovery-search-exact-photo-cell">
          {selectable ? (
            <span className="discovery-search-exact-select">
              <Checkbox
                checked={selected}
                onCheckedChange={onToggleSelect}
                aria-label="Select unknown creator"
              />
            </span>
          ) : null}
          <div className="discovery-search-exact-photo-wrap flex size-[84px] items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">
            ?
          </div>
        </div>
        <div className="discovery-search-exact-info-cell">
          <div className="discovery-search-exact-info-stack">
            <div className="discovery-search-exact-name">Unknown creator</div>
            <div className="discovery-search-exact-handle">Profile not resolved</div>
            {isShortlistCreatorQuoted(item.quotation_refs) ? (
              <div className="discovery-search-exact-info-badges">
                <ShortlistCreatorQuotedLabel refs={item.quotation_refs} />
              </div>
            ) : null}
          </div>
        </div>
        <div className="discovery-search-exact-tier-cell">
          <ShortlistCreatorTierCell creator={null} />
        </div>
        <div className="discovery-search-exact-category-cell">
          <span className="text-[11px] text-muted-foreground/60">—</span>
        </div>
        <div className="discovery-search-exact-stat-box opacity-40">
          <span className="text-[11px] text-muted-foreground">No metrics</span>
        </div>
        <div className="discovery-search-exact-feed-thumbs discovery-search-exact-feed-thumbs--empty" />
        <div className="discovery-search-exact-status-cell">
          <ShortlistCreatorStatusCell itemStatus={item.item_status} />
        </div>
        <div className="discovery-search-exact-quoted-cell">
          <ShortlistCreatorQuotedCell quotationRefs={item.quotation_refs} />
        </div>
      </div>
    );
  }

  const enrichmentStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
  const enriching = isEnrichmentInProgress(enrichmentStatus);

  return (
    <DiscoveryCreatorExactRow
      creator={creator}
      selected={selected}
      selectable={selectable}
      enriching={enriching}
      onToggleSelect={onToggleSelect}
      onOpenCreator={() => onOpenCreator?.(creator)}
      rowBehavior="open-detail"
      interestChipVariant="icat"
      className={shortlistCreatorSyncBorderClass(enrichmentStatus)}
      metaColumns={shortlistCreatorMetaRowColumns(item)}
      infoBadge={
        isShortlistCreatorQuoted(item.quotation_refs) ? (
          <ShortlistCreatorQuotedLabel refs={item.quotation_refs} />
        ) : undefined
      }
      feedMaxItems={3}
    />
  );
}

function ShortlistDisplayBlockRows({
  block,
  selectedIds,
  selectable,
  onToggleSelect,
  onToggleSelectGroup,
  onOpenCreator,
}: {
  block: ShortlistDisplayBlock;
  selectedIds: Set<string>;
  selectable: boolean;
  onToggleSelect: (itemId: string) => void;
  onToggleSelectGroup?: (itemIds: string[]) => void;
  onOpenCreator?: (creator: UnifiedCreatorResult) => void;
}) {
  if (block.kind === "collapse") {
    const memberIds = block.items.map((item) => item.item_id);
    const groupChecked = resolveGroupCheckboxState(memberIds, selectedIds);
    const groupSelected = isGroupPartiallyOrFullySelected(memberIds, selectedIds);

    return (
      <div className="shortlist-collapse-content-block collapse-content-frame">
        <ShortlistCollapseContentHeader
          label={block.label}
          creatorCount={block.items.length}
          selectable={selectable}
          checked={groupChecked}
          selected={groupSelected}
          onToggleSelect={() => onToggleSelectGroup?.(memberIds)}
        />
        {block.items.map((item) => (
          <ShortlistCreatorRow
            key={item.item_id}
            item={item}
            selected={selectedIds.has(item.item_id)}
            selectable={false}
            onToggleSelect={() => onToggleSelect(item.item_id)}
            onOpenCreator={onOpenCreator}
          />
        ))}
      </div>
    );
  }

  const item = block.items[0]!;
  return (
    <ShortlistCreatorRow
      item={item}
      selected={selectedIds.has(item.item_id)}
      selectable={selectable}
      onToggleSelect={() => onToggleSelect(item.item_id)}
      onOpenCreator={onOpenCreator}
    />
  );
}

export function ShortlistCreatorList({
  items,
  selectedIds,
  selectable,
  allSelected,
  indeterminate,
  onToggleSelect,
  onToggleSelectGroup,
  onToggleSelectAll,
  onOpenCreator,
}: Props) {
  const [sort, setSort] = useState<ShortlistCreatorSortState | null>(null);
  const sortedItems = useMemo(() => sortShortlistCreators(items, sort), [items, sort]);
  const displayBlocks = useMemo(
    () => buildShortlistDisplayBlocks(sortedItems),
    [sortedItems]
  );

  return (
    <div className="shortlist-creator-exact-root discovery-search-exact-root">
      <div className="tw-sc overflow-x-auto">
        <div style={{ minWidth: SHORTLIST_GRID_MIN_W }}>
          <div className="discovery-search-exact-header-bar">
            <DiscoveryCreatorExactHeader
              total={sortedItems.length}
              allSelected={indeterminate ? "indeterminate" : allSelected}
              hasCreators={sortedItems.length > 0}
              onToggleSelectAll={onToggleSelectAll}
              showSelectAll={selectable}
              headersClassName="shortlist-exact-table-head"
              infoColumnLabel="Creator"
              countLabel={`${sortedItems.length} Creator${sortedItems.length === 1 ? "" : "s"}`}
              metaColumns={shortlistCreatorMetaHeaderColumns(sort, setSort)}
            />
          </div>
          <div className="discovery-search-exact-scroll">
            {displayBlocks.map((block) => (
              <ShortlistDisplayBlockRows
                key={
                  block.kind === "collapse"
                    ? `collapse-${block.collapseGroupId}`
                    : block.items[0]!.item_id
                }
                block={block}
                selectedIds={selectedIds}
                selectable={selectable}
                onToggleSelect={onToggleSelect}
                onToggleSelectGroup={onToggleSelectGroup}
                onOpenCreator={onOpenCreator}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="tw-note mt-3">
        Click a creator name to open the full profile — investment score, audience,
        publications, confidence and similar creators.
      </p>
    </div>
  );
}

export function ShortlistCreatorEmptyState({
  editable,
  onAddCreators,
  onPasteLinks,
}: {
  editable: boolean;
  onAddCreators: () => void;
  onPasteLinks?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
      <div className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-muted/50">
        <UsersIcon className="size-[18px] text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-semibold text-foreground">No creators yet</p>
      <p className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground">
        {editable
          ? "Search creators or paste a list of profile links to build this shortlist."
          : "This shortlist is locked in its current status."}
      </p>
      {editable ? (
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={onAddCreators}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm"
          >
            Add creators
          </button>
          {onPasteLinks ? (
            <button
              type="button"
              onClick={onPasteLinks}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-xs font-semibold text-foreground shadow-sm"
            >
              <Link2Icon className="size-3.5" />
              Paste links
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
