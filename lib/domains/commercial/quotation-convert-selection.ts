/**
 * Release 2.0 — D2/D3 selection for Quote → Assignment convert.
 * Selected options only; one Collap package → one convert unit.
 */

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  collapsePackageGroupItems,
  collapsePackageLeaderItem,
  shouldIncludeItemInLiveTotals,
} from "@/lib/quotations/quotation-collapse-package";
import {
  normalizeOptionNumber,
  quotationCreatorDuplicateKey,
} from "@/lib/quotations/quotation-creator-options";

export type QuotationConvertUnit =
  | {
      kind: "item";
      /** Selected quotation item (non-package). */
      primaryItem: QuotationItemRow;
      memberItems: QuotationItemRow[];
    }
  | {
      kind: "package";
      collapseGroupId: string;
      /** Package commercial leader. */
      primaryItem: QuotationItemRow;
      memberItems: QuotationItemRow[];
    };

/** Phase 1: Option 1 / null is selected; option_number >= 2 are alternatives. */
export function isSelectedQuotationOption(
  optionNumber: number | null | undefined
): boolean {
  const normalized = normalizeOptionNumber(optionNumber);
  return normalized == null || normalized === 1;
}

/**
 * Build convert units from quotation items per D2 + D3.
 * Skips alternative options and collapse followers as separate units.
 */
export function buildQuotationConvertUnits(
  items: QuotationItemRow[]
): QuotationConvertUnit[] {
  const units: QuotationConvertUnit[] = [];
  const seenPackageIds = new Set<string>();
  const seenCreatorKeys = new Set<string>();

  const ordered = [...items].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)
  );

  for (const item of ordered) {
    if (!isSelectedQuotationOption(item.option_number)) continue;

    if (item.collapse_group_id) {
      const groupId = item.collapse_group_id;
      if (seenPackageIds.has(groupId)) continue;

      const groupItems = collapsePackageGroupItems(ordered, groupId).filter((row) =>
        isSelectedQuotationOption(row.option_number)
      );
      if (groupItems.length === 0) continue;

      const leader = collapsePackageLeaderItem(groupItems);
      // Only convert package when leader is in selected option set / live totals.
      if (!shouldIncludeItemInLiveTotals(leader, ordered)) continue;

      seenPackageIds.add(groupId);
      units.push({
        kind: "package",
        collapseGroupId: groupId,
        primaryItem: leader,
        memberItems: groupItems,
      });
      continue;
    }

    const creatorKey = quotationCreatorDuplicateKey(item);
    // One selected non-package line per creator key (first in sort order).
    if (seenCreatorKeys.has(creatorKey)) continue;
    seenCreatorKeys.add(creatorKey);

    units.push({
      kind: "item",
      primaryItem: item,
      memberItems: [item],
    });
  }

  return units;
}

export type QuotationConvertSelectionSummary = {
  unitCount: number;
  packageCount: number;
  itemCount: number;
  skippedAlternativeCount: number;
};

export function summarizeQuotationConvertSelection(
  items: QuotationItemRow[]
): QuotationConvertSelectionSummary {
  const units = buildQuotationConvertUnits(items);
  const skippedAlternativeCount = items.filter(
    (item) => !isSelectedQuotationOption(item.option_number)
  ).length;

  return {
    unitCount: units.length,
    packageCount: units.filter((u) => u.kind === "package").length,
    itemCount: units.filter((u) => u.kind === "item").length,
    skippedAlternativeCount,
  };
}
