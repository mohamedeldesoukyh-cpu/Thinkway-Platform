import type { SupabaseClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function engagementBand(rate: number | null): string {
  if (rate == null) return "unknown";
  if (rate < 1) return "low";
  if (rate < 3) return "mid";
  return "high";
}

function similarityScore(base: UnifiedCreatorResult, candidate: UnifiedCreatorResult): number {
  let score = 0;

  const baseNiche = (base.ai_niche ?? base.ai_category ?? base.categories[0] ?? "").toLowerCase();
  const candNiche = (
    candidate.ai_niche ??
    candidate.ai_category ??
    candidate.categories[0] ??
    ""
  ).toLowerCase();

  if (baseNiche && candNiche && (baseNiche === candNiche || candNiche.includes(baseNiche))) {
    score += 35;
  }

  if (
    base.estimated_country &&
    candidate.estimated_country &&
    base.estimated_country === candidate.estimated_country
  ) {
    score += 20;
  }

  const baseFollowers = base.metrics.followers.value ?? 0;
  const candFollowers = candidate.metrics.followers.value ?? 0;
  const ratio =
    baseFollowers > 0 ? candFollowers / baseFollowers : candFollowers === 0 ? 1 : 0;
  if (ratio >= 0.5 && ratio <= 2) score += 25;

  if (
    engagementBand(base.metrics.engagement_rate.value) ===
    engagementBand(candidate.metrics.engagement_rate.value)
  ) {
    score += 15;
  }

  const primaryPlatform = base.platforms[0]?.platform;
  if (primaryPlatform && candidate.platforms.some((p) => p.platform === primaryPlatform)) {
    score += 5;
  }

  return Math.min(100, score);
}

export async function findSimilarCreators(
  supabase: SupabaseClient,
  creator: UnifiedCreatorResult,
  limit = 8
): Promise<Array<UnifiedCreatorResult & { similarity_score: number }>> {
  const niche = creator.ai_niche ?? creator.ai_category ?? creator.categories[0];
  const result = await browseUnifiedCreators(supabase, {
    platform: creator.platforms[0]?.platform,
    country: creator.estimated_country ?? creator.country_code ?? undefined,
    category: niche ?? undefined,
    pageSize: 40,
  });

  return result.creators
    .filter((c) => c.unified_id !== creator.unified_id)
    .map((c) => ({ ...c, similarity_score: similarityScore(creator, c) }))
    .filter((c) => c.similarity_score >= 25)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit);
}
