import { INFLUENCER_TIER_ORDER, resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import {
  computeQuotationRowComputed,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  deliverableTypeLines,
  formatTypeLinesSummary,
} from "@/lib/quotations/quotation-deliverable-types";
import {
  buildQuotationItemOptionContext,
  normalizeOptionNumber,
  quotationCreatorDuplicateKey,
} from "@/lib/quotations/quotation-creator-options";

export type QuotationWorkspaceSortField =
  | "option"
  | "followers"
  | "tier"
  | "service"
  | "platform"
  | "type"
  | "price"
  | "status";

export type QuotationWorkspaceSortDirection = "asc" | "desc";

export type QuotationWorkspaceSortState = {
  field: QuotationWorkspaceSortField;
  direction: QuotationWorkspaceSortDirection;
};

export type QuotationWorkspaceSortContext = {
  drafts: Record<string, QuotationRowDraft | undefined>;
  pendingItemIds?: Set<string>;
};

const SAVE_STATUS_ORDER = ["error", "pending", "saving", "saved", "idle"] as const;

const DEFAULT_DIRECTION: Record<
  QuotationWorkspaceSortField,
  QuotationWorkspaceSortDirection
> = {
  option: "asc",
  followers: "desc",
  tier: "desc",
  service: "asc",
  platform: "asc",
  type: "asc",
  price: "desc",
  status: "asc",
};

function compareNumbers(
  left: number,
  right: number,
  direction: QuotationWorkspaceSortDirection
): number {
  const delta = left - right;
  return direction === "asc" ? delta : -delta;
}

function compareStrings(
  left: string,
  right: string,
  direction: QuotationWorkspaceSortDirection
): number {
  const cmp = left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
  return direction === "asc" ? cmp : -cmp;
}

function compareNullableNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: QuotationWorkspaceSortDirection
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return compareNumbers(left, right, direction);
}

function tierRank(item: QuotationItemRow): number {
  const label = resolveCreatorTierLabel({ followers: item.followers });
  if (label === "Unknown") return INFLUENCER_TIER_ORDER.length;
  const idx = INFLUENCER_TIER_ORDER.indexOf(label);
  return idx >= 0 ? idx : INFLUENCER_TIER_ORDER.length;
}

function typeSummary(item: QuotationItemRow): string {
  if (!item.deliverables.length) return "";
  return item.deliverables
    .map((d) => formatTypeLinesSummary(deliverableTypeLines(d)))
    .join(", ");
}

function priceEgp(item: QuotationItemRow, ctx: QuotationWorkspaceSortContext): number {
  const draft = ctx.drafts[item.id];
  if (draft) return computeQuotationRowComputed(draft).revenueEgp;
  return item.revenue_egp ?? 0;
}

function saveRank(item: QuotationItemRow, ctx: QuotationWorkspaceSortContext): number {
  const status = ctx.pendingItemIds?.has(item.id) ? "pending" : "idle";
  const idx = SAVE_STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : SAVE_STATUS_ORDER.length;
}

function compareItems(
  a: QuotationItemRow,
  b: QuotationItemRow,
  sort: QuotationWorkspaceSortState,
  ctx: QuotationWorkspaceSortContext,
  optionById: Map<string, number>
): number {
  const { field, direction } = sort;
  let cmp = 0;

  switch (field) {
    case "option": {
      const optA =
        optionById.get(a.id) ??
        normalizeOptionNumber(a.option_number) ??
        Number.MAX_SAFE_INTEGER;
      const optB =
        optionById.get(b.id) ??
        normalizeOptionNumber(b.option_number) ??
        Number.MAX_SAFE_INTEGER;
      cmp = compareNumbers(optA, optB, direction);
      break;
    }
    case "followers":
      cmp = compareNullableNumbers(a.followers, b.followers, direction);
      break;
    case "tier":
      cmp = compareNumbers(tierRank(a), tierRank(b), direction);
      break;
    case "service":
      cmp = compareStrings(a.service_description ?? "", b.service_description ?? "", direction);
      break;
    case "platform":
      cmp = compareStrings(a.platform ?? "", b.platform ?? "", direction);
      break;
    case "type":
      cmp = compareStrings(typeSummary(a), typeSummary(b), direction);
      break;
    case "price":
      cmp = compareNumbers(priceEgp(a, ctx), priceEgp(b, ctx), direction);
      break;
    case "status":
      cmp = compareNumbers(saveRank(a, ctx), saveRank(b, ctx), direction);
      break;
    default:
      cmp = 0;
  }

  if (cmp !== 0) return cmp;
  return a.sort_order - b.sort_order;
}

export function applyQuotationWorkspaceHeaderSort(
  current: QuotationWorkspaceSortState | null,
  field: QuotationWorkspaceSortField
): QuotationWorkspaceSortState {
  if (current?.field === field) {
    return {
      field,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { field, direction: DEFAULT_DIRECTION[field] };
}

/** Sort visible quotation lines; stable tie-break on sort_order. */
export function sortQuotationWorkspaceItems(
  items: QuotationItemRow[],
  sort: QuotationWorkspaceSortState | null,
  ctx: QuotationWorkspaceSortContext
): QuotationItemRow[] {
  if (!sort) {
    return [...items].sort((a, b) => a.sort_order - b.sort_order);
  }

  const optionById = buildQuotationItemOptionContext(items);
  return [...items].sort((a, b) =>
    compareItems(a, b, sort, ctx, optionById)
  );
}

/** Preserve creator grouping while respecting the sorted line order. */
export function buildCreatorGroupsFromSortedItems(
  sortedItems: QuotationItemRow[]
): Array<{ creatorKey: string; items: QuotationItemRow[] }> {
  const byCreator = new Map<string, QuotationItemRow[]>();

  for (const item of sortedItems) {
    const key = quotationCreatorDuplicateKey(item);
    const bucket = byCreator.get(key) ?? [];
    bucket.push(item);
    byCreator.set(key, bucket);
  }

  const groups: Array<{ creatorKey: string; items: QuotationItemRow[] }> = [];
  const seen = new Set<string>();

  for (const item of sortedItems) {
    const key = quotationCreatorDuplicateKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({ creatorKey: key, items: byCreator.get(key) ?? [] });
  }

  return groups;
}
