/**
 * Discovery / compare UI — resolve creator category chips with inference fallback.
 * Stored tags win when they map to a main category; otherwise infer from bio,
 * display name (pipe roles), handle, and platform metadata (same pipeline as quotations).
 */
import { resolveQuotationCreatorDisplayCategories } from "@/lib/quotations/quotation-creator-categories";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

/** Max category chips shown in Discovery search rows, exports, and compare matrices. */
export const DISCOVERY_CREATOR_CATEGORY_CHIP_LIMIT = 3;

/** Resolve display categories for a unified creator (stored + inferred, max 3). */
export function resolveDiscoveryCreatorDisplayCategories(
  creator: UnifiedCreatorResult
): string[] {
  return resolveQuotationCreatorDisplayCategories({ creator });
}

/** Comma-separated label for tables, CSV export, and compare cells. */
export function discoveryCreatorCategoriesLabel(creator: UnifiedCreatorResult): string {
  const parts = resolveDiscoveryCreatorDisplayCategories(creator).slice(
    0,
    DISCOVERY_CREATOR_CATEGORY_CHIP_LIMIT
  );
  return parts.length ? parts.join(", ") : "—";
}
