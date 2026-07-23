import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorEnrichmentStatus } from "@/lib/creator-enrichment/types";

/**
 * Primary pin groups for Discovery browse + search (lower rank first).
 * 0 = fully enriched
 * 1 = partial, or timestamp-only (`last_enriched_at` without enriched status)
 * 2 = never / failed / queued / running / skipped without a timestamp
 */
export function enrichmentSortRank(
  creator: Pick<UnifiedCreatorResult, "enrichment_status" | "last_enriched_at" | "updated_at">
): number {
  const status = (creator.enrichment_status ?? "never") as CreatorEnrichmentStatus;
  if (status === "enriched") return 0;
  if (status === "partial" || status === "awaiting_profile_details") return 1;
  if (creator.last_enriched_at || creator.updated_at) return 1;
  return 2;
}

export function compareEnrichmentSortRank(
  a: Pick<UnifiedCreatorResult, "enrichment_status" | "last_enriched_at" | "updated_at">,
  b: Pick<UnifiedCreatorResult, "enrichment_status" | "last_enriched_at" | "updated_at">
): number {
  return enrichmentSortRank(a) - enrichmentSortRank(b);
}
