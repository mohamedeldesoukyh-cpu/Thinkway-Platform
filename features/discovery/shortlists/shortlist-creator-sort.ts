import { filterPlatformsForDisplay } from "@/lib/creators/creator-centric";
import { resolveDiscoveryCreatorDisplayCategories } from "@/lib/creators/creator-display-categories";
import {
  INFLUENCER_TIER_ORDER,
  resolveCreatorTierFromUnified,
  type CreatorTierLabel,
} from "@/lib/creators/creator-tier";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  resolveEnrichmentDisplayStatus,
  type CreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import {
  resolveSortEngagement,
  resolveSortFollowers,
} from "@/features/discovery/components/creator-search/creator-search-sort";
import type { ShortlistItemStatus } from "@/types/database";

import { SHORTLIST_ITEM_STATUSES } from "./constants";
import type { ShortlistCreatorQuotationRef } from "./types";

export type ShortlistCreatorSortField =
  | "rank"
  | "creator"
  | "platform"
  | "followers"
  | "tier"
  | "country"
  | "interests"
  | "engagement"
  | "brand_safety"
  | "sync"
  | "status"
  | "quoted";

export type ShortlistCreatorSortDirection = "asc" | "desc";

export type ShortlistCreatorSortState = {
  field: ShortlistCreatorSortField;
  direction: ShortlistCreatorSortDirection;
};

export type ShortlistSortableRow = {
  item_id: string;
  item_status: ShortlistItemStatus;
  creator: UnifiedCreatorResult | null;
  quotation_refs: ShortlistCreatorQuotationRef[];
};

const ENRICHMENT_STATUS_ORDER: CreatorEnrichmentStatus[] = [
  "never",
  "queued",
  "running",
  "partial",
  "enriched",
  "failed",
  "skipped",
];

const DEFAULT_DIRECTION: Record<ShortlistCreatorSortField, ShortlistCreatorSortDirection> = {
  rank: "asc",
  creator: "asc",
  platform: "asc",
  followers: "desc",
  tier: "desc",
  country: "asc",
  interests: "asc",
  engagement: "desc",
  brand_safety: "desc",
  sync: "asc",
  status: "asc",
  quoted: "desc",
};

function compareNumbers(
  left: number,
  right: number,
  direction: ShortlistCreatorSortDirection
): number {
  const delta = left - right;
  return direction === "asc" ? delta : -delta;
}

function compareStrings(
  left: string,
  right: string,
  direction: ShortlistCreatorSortDirection
): number {
  const cmp = left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
  return direction === "asc" ? cmp : -cmp;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: ShortlistCreatorSortDirection
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return compareNumbers(left, right, direction);
}

function compareNullableStrings(
  left: string | null,
  right: string | null,
  direction: ShortlistCreatorSortDirection
): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return compareStrings(left, right, direction);
}

function resolveSortPlatform(creator: UnifiedCreatorResult): string {
  return [...creator.platforms]
    .map((platform) => platform.platform.trim().toLowerCase())
    .sort()
    .join(", ");
}

function resolveSortCountry(creator: UnifiedCreatorResult): string {
  const primary = creator.platforms[0];
  return (
    primary?.audience_country ??
    creator.estimated_country ??
    creator.country_code ??
    ""
  )
    .trim()
    .toUpperCase();
}

function resolveSortBrandSafety(creator: UnifiedCreatorResult): number {
  return creator.authenticity_score ?? -1;
}

function tierSortIndex(tier: CreatorTierLabel): number {
  const idx = INFLUENCER_TIER_ORDER.indexOf(tier as (typeof INFLUENCER_TIER_ORDER)[number]);
  return idx === -1 ? INFLUENCER_TIER_ORDER.length : idx;
}

function resolveInterestsSortValue(creator: UnifiedCreatorResult | null): string | null {
  if (!creator) return null;
  const parts = resolveDiscoveryCreatorDisplayCategories(creator);
  return parts.length > 0 ? parts.join(", ").toLowerCase() : null;
}

function resolveSyncSortValue(creator: UnifiedCreatorResult | null): number | null {
  if (!creator) return null;
  const status = resolveEnrichmentDisplayStatus(creator.enrichment_status, creator);
  const idx = ENRICHMENT_STATUS_ORDER.indexOf(status);
  return idx === -1 ? ENRICHMENT_STATUS_ORDER.length : idx;
}

function resolveStatusSortValue(status: ShortlistItemStatus): number {
  const idx = SHORTLIST_ITEM_STATUSES.indexOf(status);
  return idx === -1 ? SHORTLIST_ITEM_STATUSES.length : idx;
}

function resolveQuotedSortValue(refs: ShortlistCreatorQuotationRef[]): number {
  return refs.length;
}

function resolveCreatorName(creator: UnifiedCreatorResult | null): string | null {
  return creator?.display_name?.trim() || null;
}

function resolveEngagementSortValue(creator: UnifiedCreatorResult | null): number | null {
  if (!creator) return null;
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms);
  if (displayPlatforms.length === 1) {
    const rate = displayPlatforms[0]?.engagement_rate;
    return rate != null && Number.isFinite(rate) ? rate : null;
  }
  const rate = resolveSortEngagement(creator);
  return Number.isFinite(rate) ? rate : null;
}

export function defaultDirectionForShortlistSortField(
  field: ShortlistCreatorSortField
): ShortlistCreatorSortDirection {
  return DEFAULT_DIRECTION[field];
}

export function applyShortlistHeaderSort(
  current: ShortlistCreatorSortState | null,
  field: ShortlistCreatorSortField
): ShortlistCreatorSortState {
  if (current?.field === field) {
    return {
      field,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { field, direction: defaultDirectionForShortlistSortField(field) };
}

function compareRows(
  left: { row: ShortlistSortableRow; index: number },
  right: { row: ShortlistSortableRow; index: number },
  sort: ShortlistCreatorSortState
): number {
  const { field, direction } = sort;
  const leftCreator = left.row.creator;
  const rightCreator = right.row.creator;

  let primary = 0;

  switch (field) {
    case "rank":
      primary = compareNumbers(left.index, right.index, direction);
      break;
    case "creator":
      primary = compareNullableStrings(
        resolveCreatorName(leftCreator),
        resolveCreatorName(rightCreator),
        direction
      );
      break;
    case "platform":
      primary = compareNullableStrings(
        leftCreator ? resolveSortPlatform(leftCreator) || null : null,
        rightCreator ? resolveSortPlatform(rightCreator) || null : null,
        direction
      );
      break;
    case "followers":
      primary = compareNullableNumbers(
        leftCreator ? resolveSortFollowers(leftCreator) : null,
        rightCreator ? resolveSortFollowers(rightCreator) : null,
        direction
      );
      break;
    case "tier":
      primary = compareNullableNumbers(
        leftCreator ? tierSortIndex(resolveCreatorTierFromUnified(leftCreator)) : null,
        rightCreator ? tierSortIndex(resolveCreatorTierFromUnified(rightCreator)) : null,
        direction
      );
      break;
    case "country":
      primary = compareNullableStrings(
        leftCreator ? resolveSortCountry(leftCreator) || null : null,
        rightCreator ? resolveSortCountry(rightCreator) || null : null,
        direction
      );
      break;
    case "interests":
      primary = compareNullableStrings(
        resolveInterestsSortValue(leftCreator),
        resolveInterestsSortValue(rightCreator),
        direction
      );
      break;
    case "engagement":
      primary = compareNullableNumbers(
        resolveEngagementSortValue(leftCreator),
        resolveEngagementSortValue(rightCreator),
        direction
      );
      break;
    case "brand_safety":
      primary = compareNullableNumbers(
        leftCreator ? resolveSortBrandSafety(leftCreator) : null,
        rightCreator ? resolveSortBrandSafety(rightCreator) : null,
        direction
      );
      break;
    case "sync":
      primary = compareNullableNumbers(
        resolveSyncSortValue(leftCreator),
        resolveSyncSortValue(rightCreator),
        direction
      );
      break;
    case "status":
      primary = compareNumbers(
        resolveStatusSortValue(left.row.item_status),
        resolveStatusSortValue(right.row.item_status),
        direction
      );
      break;
    case "quoted":
      primary = compareNumbers(
        resolveQuotedSortValue(left.row.quotation_refs),
        resolveQuotedSortValue(right.row.quotation_refs),
        direction
      );
      break;
  }

  if (primary !== 0) {
    return primary;
  }

  return compareNumbers(left.index, right.index, "asc");
}

/** Stable client-side sort over the loaded shortlist rows. */
export function sortShortlistCreators<T extends ShortlistSortableRow>(
  items: readonly T[],
  sort: ShortlistCreatorSortState | null
): T[] {
  if (!sort) {
    return [...items];
  }

  const indexed = items.map((row, index) => ({ row, index }));
  indexed.sort((left, right) => compareRows(left, right, sort));
  return indexed.map(({ row }) => row);
}
