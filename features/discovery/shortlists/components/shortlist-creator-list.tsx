"use client";

import { useMemo, useState } from "react";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
import {
  DiscoverySuiteCell,
  DiscoverySuiteGrid,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system/discovery-suite-grid";
import {
  DiscoveryCreatorFeedThumbs,
  DiscoveryCreatorPlatformStatsBox,
} from "@/features/discovery/components/discovery-creator-platform-stats";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import {
  isEnrichmentInProgress,
  resolveCreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import { cn } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, Link2Icon, UsersIcon } from "lucide-react";
import { ini } from "@/lib/discovery/suite/helpers";

import { SHORTLIST_ITEM_STATUS_LABELS, SHORTLIST_QUOTED_COLUMN_LABEL } from "../constants";
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
import {
  isShortlistCreatorQuoted,
  ShortlistCreatorQuotedLabel,
} from "./shortlist-badges";
import {
  ShortlistCreatorQuotedCell,
  shortlistCreatorSyncBorderClass,
} from "./shortlist-creator-meta-columns";
import { resolveCreatorTierFromUnified } from "@/lib/creators/creator-tier";

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

function statusPillClass(itemStatus: ShortlistRowItem["item_status"]): string {
  switch (itemStatus) {
    case "approved":
      return "tw-p p-g";
    case "under_review":
      return "tw-p p-y";
    case "rejected":
    case "cancelled":
      return "tw-p p-r";
    default:
      return "tw-p p-n";
  }
}

function ShortlistCreatorGridRow({
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
  const stopBubble = (event: { stopPropagation: () => void }) =>
    event.stopPropagation();

  if (!creator) {
    return (
      <DiscoverySuiteRow selected={selected} className={shortlistCreatorSyncBorderClass("never")}>
        <DiscoverySuiteCell>
          {selectable ? (
            <input
              type="checkbox"
              className="tw-ck"
              checked={selected}
              onChange={onToggleSelect}
              aria-label="Select unknown creator"
            />
          ) : null}
        </DiscoverySuiteCell>
        <DiscoverySuiteCell>
          <span className="tw-cw2">
            <span className="tw-avx" aria-hidden>
              ?
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="nm">Unknown creator</span>
              <span className="hd">Profile not resolved</span>
            </span>
          </span>
        </DiscoverySuiteCell>
        <DiscoverySuiteCell>
          <span className="tw-miss">—</span>
        </DiscoverySuiteCell>
        <DiscoverySuiteCell>
          <span className="tw-miss">—</span>
        </DiscoverySuiteCell>
        <DiscoverySuiteCell>
          <span className="tw-miss">No metrics</span>
        </DiscoverySuiteCell>
        <DiscoverySuiteCell>
          <div className="tw-thumbs">
            <span className="tw-thumb" aria-hidden />
            <span className="tw-thumb" aria-hidden />
            <span className="tw-thumb" aria-hidden />
          </div>
        </DiscoverySuiteCell>
        <DiscoverySuiteCell>
          <span className={statusPillClass(item.item_status)}>
            {SHORTLIST_ITEM_STATUS_LABELS[item.item_status]}
          </span>
        </DiscoverySuiteCell>
        <DiscoverySuiteCell>
          <ShortlistCreatorQuotedCell quotationRefs={item.quotation_refs} />
        </DiscoverySuiteCell>
      </DiscoverySuiteRow>
    );
  }

  const enrichmentStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
  const enriching = isEnrichmentInProgress(enrichmentStatus);
  const vm = buildDiscoveryCreatorViewModel(creator);
  const tier = resolveCreatorTierFromUnified(creator);
  const openCreatorDetail = () => onOpenCreator?.(creator);

  return (
    <DiscoverySuiteRow
      selected={selected}
      className={cn(shortlistCreatorSyncBorderClass(enrichmentStatus), enriching && "wrn")}
    >
      <DiscoverySuiteCell>
        {selectable ? (
          <input
            type="checkbox"
            className="tw-ck"
            checked={selected}
            onChange={onToggleSelect}
            onClick={stopBubble}
            aria-label={`${selected ? "Deselect" : "Select"} ${vm.displayName}`}
          />
        ) : null}
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <span className="tw-cw2">
          <span className="tw-avx relative overflow-hidden">
            {vm.avatarUrl ? (
              <CreatorAvatarImage
                avatarUrl={vm.avatarUrl}
                profileUrl={vm.profileUrl}
                alt={vm.displayName}
                sizeClassName="size-full"
                className="border-0"
              />
            ) : (
              <span aria-hidden>{ini(vm.displayName).slice(0, 2)}</span>
            )}
            {vm.countryFlagCodes.length > 0 ? (
              <span className="fl">
                <CountryFlagsStack
                  countryCodes={vm.countryFlagCodes}
                  size="sm"
                  overlay
                  className="size-full"
                />
              </span>
            ) : null}
          </span>
          <span style={{ minWidth: 0 }}>
            <button
              type="button"
              className="nm max-w-full min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left font-[inherit]"
              title={vm.displayName}
              onClick={(event) => {
                stopBubble(event);
                openCreatorDetail();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  stopBubble(event);
                  openCreatorDetail();
                }
              }}
            >
              {vm.displayName}
            </button>
            {vm.handleLabel ? <span className="hd">{vm.handleLabel}</span> : null}
            {vm.countryLabel !== "—" ? <span className="lo">{vm.countryLabel}</span> : null}
            {isShortlistCreatorQuoted(item.quotation_refs) ? (
              <span className="mt-1 block" onClick={stopBubble}>
                <ShortlistCreatorQuotedLabel refs={item.quotation_refs} />
              </span>
            ) : null}
          </span>
        </span>
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        {tier === "Unknown" ? (
          <span className="tw-miss">—</span>
        ) : (
          <span className="tw-p p-v">{tier}</span>
        )}
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        {vm.categories.length > 0 ? (
          <span className="tw-tags">
            {vm.categories.slice(0, 2).map((cat) => (
              <span key={cat}>{cat}</span>
            ))}
            {vm.categories.length > 2 ? (
              <span className="m">+{vm.categories.length - 2}</span>
            ) : null}
          </span>
        ) : (
          <span className="tw-miss">—</span>
        )}
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <DiscoveryCreatorPlatformStatsBox platformStats={vm.platformStats} />
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <DiscoveryCreatorFeedThumbs publications={vm.feedPublications} maxItems={3} />
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <span className={statusPillClass(item.item_status)}>
          {SHORTLIST_ITEM_STATUS_LABELS[item.item_status]}
        </span>
      </DiscoverySuiteCell>

      <DiscoverySuiteCell>
        <ShortlistCreatorQuotedCell quotationRefs={item.quotation_refs} />
      </DiscoverySuiteCell>
    </DiscoverySuiteRow>
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
      <>
        <div className="tw-gp">
          {selectable ? (
            <input
              type="checkbox"
              className="tw-ck mr-2"
              checked={groupChecked === true}
              ref={(el) => {
                if (el) el.indeterminate = groupChecked === "indeterminate";
              }}
              onChange={() => onToggleSelectGroup?.(memberIds)}
              aria-label={`Select group ${block.label}`}
            />
          ) : null}
          {block.label}
          <em>
            {block.items.length} creator{block.items.length === 1 ? "" : "s"}
            {groupSelected ? " · selected" : ""}
          </em>
        </div>
        {block.items.map((item) => (
          <ShortlistCreatorGridRow
            key={item.item_id}
            item={item}
            selected={selectedIds.has(item.item_id)}
            selectable={false}
            onToggleSelect={() => onToggleSelect(item.item_id)}
            onOpenCreator={onOpenCreator}
          />
        ))}
      </>
    );
  }

  const item = block.items[0]!;
  return (
    <ShortlistCreatorGridRow
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

  const header = (
    <>
      <DiscoverySuiteCell>
        {selectable ? (
          <input
            type="checkbox"
            className="tw-ck"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = indeterminate;
            }}
            onChange={onToggleSelectAll}
            aria-label="Select all creators"
            disabled={sortedItems.length === 0}
          />
        ) : null}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Creator</DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <SortableMetaLabel label="Tier" field="tier" sort={sort} onSortChange={setSort} />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Category</DiscoverySuiteCell>
      <DiscoverySuiteCell>Statistics</DiscoverySuiteCell>
      <DiscoverySuiteCell>Content from feed</DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <SortableMetaLabel label="Status" field="status" sort={sort} onSortChange={setSort} />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>
        <SortableMetaLabel
          label={SHORTLIST_QUOTED_COLUMN_LABEL}
          field="quoted"
          sort={sort}
          onSortChange={setSort}
        />
      </DiscoverySuiteCell>
    </>
  );

  return (
    <div>
      <DiscoverySuiteGrid
        cols="shortlist"
        framed={false}
        header={header}
      >
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
      </DiscoverySuiteGrid>
      <p className="tw-note">
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
