/**
 * Discovery / compare UI — resolve creator category chips with inference fallback.
 * Stored tags win when they map to a main category; otherwise infer from bio,
 * display name (pipe roles), handle, and platform metadata (same pipeline as quotations).
 */
import { resolveQuotationCreatorDisplayCategories } from "@/lib/quotations/quotation-creator-categories";
import {
  CREATOR_PR_CATEGORY,
  creatorHasPrCategory,
} from "@/lib/creators/category-keywords";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

/** Max category chips shown in Discovery search rows, exports, and compare matrices. */
export const DISCOVERY_CREATOR_CATEGORY_CHIP_LIMIT = 3;

/** Resolve display categories for a unified creator (stored + inferred, max 3). */
export function resolveDiscoveryCreatorDisplayCategories(
  creator: UnifiedCreatorResult
): string[] {
  return resolveQuotationCreatorDisplayCategories({ creator });
}

/**
 * Keep the chip budget while ensuring the canonical PR tag stays visible when present.
 * PR is a manual pack checkbox — it must not disappear behind IG niches / Lifestyle.
 */
export function takeDiscoveryCategoryChips(
  categories: ReadonlyArray<string>,
  limit: number = DISCOVERY_CREATOR_CATEGORY_CHIP_LIMIT
): string[] {
  const list = categories.map((tag) => tag.trim()).filter(Boolean);
  if (list.length <= limit) return [...list];
  if (!creatorHasPrCategory(list)) return list.slice(0, limit);

  const prLabel =
    list.find((tag) => tag.toLowerCase() === CREATOR_PR_CATEGORY.toLowerCase()) ??
    CREATOR_PR_CATEGORY;
  const withoutPr = list.filter(
    (tag) => tag.toLowerCase() !== CREATOR_PR_CATEGORY.toLowerCase()
  );
  return [prLabel, ...withoutPr].slice(0, limit);
}

/** Comma-separated label for tables, CSV export, and compare cells. */
export function discoveryCreatorCategoriesLabel(creator: UnifiedCreatorResult): string {
  const parts = takeDiscoveryCategoryChips(
    resolveDiscoveryCreatorDisplayCategories(creator)
  );
  return parts.length ? parts.join(", ") : "—";
}
