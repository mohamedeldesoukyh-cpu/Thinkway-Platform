import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { isSyntheticCreatorUsername } from "@/lib/discovery/demo-data";

function publicDiscoveryHandle(creator: UnifiedCreatorResult): string | null {
  const handle = creator.platforms[0]?.handle?.replace(/^@+/, "").trim();
  return handle || null;
}

/** Exclude mock-seeded / placeholder discovery profiles in production search. */
export function passesProductionCreatorGate(creator: UnifiedCreatorResult): boolean {
  if (creator.influencer_id) return true;
  if (
    creator.source_type === "internal" ||
    creator.source_type === "oauth_verified" ||
    creator.source_type === "imported"
  ) {
    return true;
  }

  if (creator.source_type !== "public_discovery") return false;

  const stage = creator.status ?? "";
  if (stage === "discovered" || stage === "basic_enriched") {
    const handle = publicDiscoveryHandle(creator);
    return Boolean(handle && !isSyntheticCreatorUsername(handle));
  }
  if (creator.bio?.toLowerCase().includes("collabs:")) return false;

  return stage === "metrics_enriched" || stage === "ai_scored" || stage === "verified";
}

/** Search visibility only: keep past enrichment even if the latest refresh failed. */
export function hasCreatorEnrichment(creator: UnifiedCreatorResult): boolean {
  if (creator.last_enriched_at || ["enriched", "partial"].includes(creator.enrichment_status ?? "")) return true;
  if (["basic_enriched", "metrics_enriched", "ai_scored", "verified"].includes(creator.status ?? "")) return true;
  return creator.platforms.some(account => Boolean(
    account.metrics_last_synced_at ||
    ["enriched", "partial"].includes(account.enrichment_status ?? "") ||
    (account.sync_status === "synced" && account.last_synced_at)
  ));
}

export type CreatorActivityFilter = "active" | "inactive" | "all";
export function matchesCreatorActivity(creator: UnifiedCreatorResult, filter: CreatorActivityFilter = "active"): boolean {
  return filter === "all" || hasCreatorEnrichment(creator) === (filter === "active");
}
