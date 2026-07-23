import type { CreatorEnrichmentStatus } from "@/lib/creator-enrichment/types";

/**
 * ID-stage pin tier used by browse_influencer_ids_by_recency and the legacy
 * Node sort when platforms are not loaded (multi-platform tiers 0–1 unreachable).
 * Lower = higher on page.
 */
export function browseIdStagePinTier(row: {
  enrichment_status?: CreatorEnrichmentStatus | string | null;
  last_enriched_at?: string | null;
  updated_at?: string | null;
}): number {
  const hasRecency = Boolean(row.last_enriched_at ?? row.updated_at);
  if (row.enrichment_status === "enriched" && hasRecency) return 2;
  if (row.enrichment_status === "enriched") return 3;
  if (hasRecency) return 4;
  return 5;
}
