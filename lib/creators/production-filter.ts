import type { UnifiedCreatorResult } from "@/lib/creators/types";

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
  if (stage === "discovered" || stage === "basic_enriched") return false;
  if (creator.bio?.toLowerCase().includes("collabs:")) return false;

  return stage === "metrics_enriched" || stage === "ai_scored" || stage === "verified";
}
