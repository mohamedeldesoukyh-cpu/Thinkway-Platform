/**
 * Release 2.0 — D2/D3 selection for Quote → Assignment convert.
 * Selected options only; one Collap package → one convert unit.
 *
 * Selection must match the quotation workspace Option labels
 * (`buildQuotationItemOptionContext`): first line per creator = Option 1,
 * even when stored `option_number` was left as 2+ after Option 1 was removed.
 */

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  collapsePackageGroupItems,
  collapsePackageLeaderItem,
} from "@/lib/quotations/quotation-collapse-package";
import {
  buildQuotationItemOptionContext,
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

/** Phase 1 fallback when no workspace context is available. */
export function isSelectedQuotationOption(
  optionNumber: number | null | undefined
): boolean {
  const normalized = normalizeOptionNumber(optionNumber);
  return normalized == null || normalized === 1;
}

function isDisplaySelectedOption(
  itemId: string,
  optionContext: ReturnType<typeof buildQuotationItemOptionContext>
): boolean {
  return (optionContext.get(itemId)?.optionNumber ?? 1) === 1;
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
  // Same Option 1 / 2 / 3… labels the quotation workspace shows.
  const optionContext = buildQuotationItemOptionContext(ordered);

  for (const item of ordered) {
    if (!isDisplaySelectedOption(item.id, optionContext)) continue;

    if (item.collapse_group_id) {
      const groupId = item.collapse_group_id;
      if (seenPackageIds.has(groupId)) continue;

      const groupItems = collapsePackageGroupItems(ordered, groupId).filter((row) =>
        isDisplaySelectedOption(row.id, optionContext)
      );
      if (groupItems.length === 0) continue;

      // Commercial leader among the selected option members of this package.
      const leader = collapsePackageLeaderItem(groupItems);

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
  const ordered = [...items].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)
  );
  const optionContext = buildQuotationItemOptionContext(ordered);
  const units = buildQuotationConvertUnits(items);
  const skippedAlternativeCount = ordered.filter(
    (item) => !isDisplaySelectedOption(item.id, optionContext)
  ).length;

  return {
    unitCount: units.length,
    packageCount: units.filter((u) => u.kind === "package").length,
    itemCount: units.filter((u) => u.kind === "item").length,
    skippedAlternativeCount,
  };
}
