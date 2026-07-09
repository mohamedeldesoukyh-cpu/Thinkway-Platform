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
