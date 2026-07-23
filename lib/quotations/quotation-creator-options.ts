import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

import { isManualQuotationCreator } from "./quotation-creator-platform-utils";

export type QuotationCreatorRef = Pick<
  QuotationItemRow,
  "id" | "unified_id" | "influencer_id" | "profile_id" | "creator_name" | "handle"
>;

export type QuotationCreatorOptionSet = {
  optionNumber: number | null;
  items: QuotationItemRow[];
  shadeIndex: number;
};

export type QuotationCreatorGroup = {
  creatorKey: string;
  optionSets: QuotationCreatorOptionSet[];
};

/** Match duplicated lines — same profile IDs or same creator name + handle. */
export function quotationCreatorDuplicateKey(
  item: Pick<
    QuotationItemRow,
    "id" | "unified_id" | "influencer_id" | "profile_id" | "creator_name" | "handle"
  >
): string {
  if (item.unified_id) return `u:${item.unified_id}`;
  if (item.influencer_id) return `i:${item.influencer_id}`;
  if (item.profile_id) return `p:${item.profile_id}`;
  if (isManualQuotationCreator(item)) return `m:${item.id}`;
  const name = item.creator_name?.trim().toLowerCase() ?? "";
  const handle = item.handle?.trim().toLowerCase().replace(/^@/, "") ?? "";
  if (name || handle) return `n:${name}|${handle}`;
  return `id:${item.id}`;
}

/** @deprecated Use quotationCreatorDuplicateKey for duplicate detection. */
export function quotationItemCreatorKey(item: QuotationCreatorRef): string {
  return quotationCreatorDuplicateKey(item);
}

export function isSameQuotationCreator(
  a: Pick<
    QuotationItemRow,
    "id" | "unified_id" | "influencer_id" | "profile_id" | "creator_name" | "handle"
  >,
  b: Pick<
    QuotationItemRow,
    "id" | "unified_id" | "influencer_id" | "profile_id" | "creator_name" | "handle"
  >
): boolean {
  return quotationCreatorDuplicateKey(a) === quotationCreatorDuplicateKey(b);
}

/** Next option label for the same creator (Option 1, 2, 3… per creator). */
export function nextQuotationOptionNumber(
  siblings: Array<{ option_number?: number | null }>
): number {
  const max = siblings.reduce(
    (highest, row) => Math.max(highest, normalizeOptionNumber(row.option_number) ?? 0),
    0
  );
  return max + 1;
}

export function normalizeOptionNumber(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 1) return null;
  return Math.floor(value);
}

/** Subtle row backgrounds so duplicated option lines are easy to scan. */
export const QUOTATION_OPTION_ROW_SHADES = [
  "border-l-2 border-l-border/60 bg-background",
  "border-l-2 border-l-sky-400/70 bg-sky-500/[0.06] dark:bg-sky-400/[0.08]",
  "border-l-2 border-l-amber-400/70 bg-amber-500/[0.08] dark:bg-amber-400/[0.1]",
  "border-l-2 border-l-violet-400/70 bg-violet-500/[0.07] dark:bg-violet-400/[0.09]",
  "border-l-2 border-l-emerald-400/70 bg-emerald-500/[0.07] dark:bg-emerald-400/[0.09]",
  "border-l-2 border-l-rose-400/70 bg-rose-500/[0.06] dark:bg-rose-400/[0.08]",
] as const;

export function quotationOptionRowShadeClass(shadeIndex: number): string {
  const idx = Math.max(0, shadeIndex) % QUOTATION_OPTION_ROW_SHADES.length;
  return QUOTATION_OPTION_ROW_SHADES[idx] ?? QUOTATION_OPTION_ROW_SHADES[0];
}

export type QuotationItemOptionContext = {
  optionNumber: number;
  duplicateCount: number;
  showOptionLabel: boolean;
  shadeIndex: number;
};

/**
 * Assign Option 1, 2, 3… in table order for repeated creators (same name / profile).
 * First row = Option 1, first duplicate = Option 2, second duplicate = Option 3, etc.
 */
export function buildQuotationItemOptionContext(
  items: QuotationItemRow[]
): Map<string, QuotationItemOptionContext> {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const totals = new Map<string, number>();

  for (const item of sorted) {
    const key = quotationCreatorDuplicateKey(item);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const result = new Map<string, QuotationItemOptionContext>();

  for (const item of sorted) {
    const key = quotationCreatorDuplicateKey(item);
    const optionNumber = (seen.get(key) ?? 0) + 1;
    seen.set(key, optionNumber);
    const duplicateCount = totals.get(key) ?? 1;
    result.set(item.id, {
      optionNumber,
      duplicateCount,
      showOptionLabel: duplicateCount > 1,
      shadeIndex: optionNumber - 1,
    });
  }

  return result;
}

/** Planned option_number per line after sequential renumber (sort_order, per creator). */
export function buildQuotationOptionRenumberPlan(
  items: Array<
    Pick<
      QuotationItemRow,
      | "id"
      | "sort_order"
      | "option_number"
      | "collapse_group_id"
      | "unified_id"
      | "influencer_id"
      | "profile_id"
      | "creator_name"
      | "handle"
    >
  >
): Array<{ id: string; option_number: number }> {
  const sorted = [...items]
    .filter((item) => !item.collapse_group_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const seen = new Map<string, number>();
  const updates: Array<{ id: string; option_number: number }> = [];

  for (const item of sorted) {
    const key = quotationCreatorDuplicateKey(item);
    const optionNumber = (seen.get(key) ?? 0) + 1;
    seen.set(key, optionNumber);
    if (item.option_number !== optionNumber) {
      updates.push({ id: item.id, option_number: optionNumber });
    }
  }

  return updates;
}

export function groupQuotationItemsByCreator(
  items: QuotationItemRow[]
): QuotationCreatorGroup[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const byCreator = new Map<string, QuotationItemRow[]>();

  for (const item of sorted) {
    const key = quotationCreatorDuplicateKey(item);
    const bucket = byCreator.get(key) ?? [];
    bucket.push(item);
    byCreator.set(key, bucket);
  }

  const groups: QuotationCreatorGroup[] = [];
  const seen = new Set<string>();

  for (const item of sorted) {
    const creatorKey = quotationCreatorDuplicateKey(item);
    if (seen.has(creatorKey)) continue;
    seen.add(creatorKey);

    const creatorItems = [...(byCreator.get(creatorKey) ?? [])].sort((a, b) => {
      const optA = normalizeOptionNumber(a.option_number) ?? Number.MAX_SAFE_INTEGER;
      const optB = normalizeOptionNumber(b.option_number) ?? Number.MAX_SAFE_INTEGER;
      if (optA !== optB) return optA - optB;
      return a.sort_order - b.sort_order;
    });

    const optionMap = new Map<string, QuotationItemRow[]>();
    for (const row of creatorItems) {
      const optKey =
        normalizeOptionNumber(row.option_number) == null
          ? "none"
          : String(normalizeOptionNumber(row.option_number));
      const bucket = optionMap.get(optKey) ?? [];
      bucket.push(row);
      optionMap.set(optKey, bucket);
    }

    const optionSets: QuotationCreatorOptionSet[] = [...optionMap.entries()]
      .sort(([a], [b]) => {
        if (a === "none") return 1;
        if (b === "none") return -1;
        return Number(a) - Number(b);
      })
      .map(([optKey, optionItems], shadeIndex) => ({
        optionNumber: optKey === "none" ? null : Number(optKey),
        items: optionItems,
        shadeIndex,
      }));

    groups.push({ creatorKey, optionSets });
  }

  return groups;
}

/** Unique influencer count (options/lines grouped by creator). */
export function countUniqueQuotationCreators(items: QuotationItemRow[]): number {
  return groupQuotationItemsByCreator(items).length;
}

/** Creator groups limited to items visible in the current filter. */
export function buildFilteredQuotationCreatorGroups(
  allItems: QuotationItemRow[],
  visibleItems: QuotationItemRow[]
): Array<{ creatorKey: string; items: QuotationItemRow[] }> {
  const visibleIds = new Set(visibleItems.map((item) => item.id));
  return groupQuotationItemsByCreator(allItems)
    .map((group) => ({
      creatorKey: group.creatorKey,
      items: group.optionSets
        .flatMap((optionSet) => optionSet.items)
        .filter((item) => visibleIds.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Dropdown choices: blank + Option 1…N for a creator's lines. */
export function quotationOptionSelectValues(
  current: number | null | undefined,
  siblingOptions: Array<number | null | undefined>
): number[] {
  const values = new Set<number>();
  for (const opt of siblingOptions) {
    const normalized = normalizeOptionNumber(opt);
    if (normalized != null) values.add(normalized);
  }
  const currentNorm = normalizeOptionNumber(current);
  if (currentNorm != null) values.add(currentNorm);
  if (values.size === 0) values.add(1);

  const max = Math.max(...values, 1);
  const upper = Math.max(max + 1, 3);
  for (let n = 1; n <= upper; n += 1) values.add(n);
  return [...values].sort((a, b) => a - b);
}
