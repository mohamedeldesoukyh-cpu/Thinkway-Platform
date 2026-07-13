/**
 * Creator Intelligence SQL projection writer (Phase H).
 *
 * Maps resolved CreatorIntelligence profiles into the `creator_intelligence`
 * table so SQL predicates can filter on intelligence instead of provenance.
 * Pure row mapping is exported separately for tests; the upsert is a thin
 * batch wrapper. Writers: the backfill script and (going forward) enrichment
 * completion. Readers arrive at predicate cutover (flagged).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorIntelligence } from "./types";

export type CreatorIntelligenceProjectionRow = {
  unified_id: string;
  source_type: string;
  display_name: string | null;
  platforms: string[];
  categories: string[];
  category_source: string;
  category_confidence: number;
  niche: string | null;
  topics: string[];
  languages: string[];
  creator_tier: string | null;
  audience_countries: string[];
  audience_age_bucket: string | null;
  audience_gender_male: number | null;
  audience_gender_female: number | null;
  brand_safety_level: string;
  max_followers: number | null;
  max_engagement_rate: number | null;
  thinkway_score: number | null;
  resolved_at: string;
};

/** Pure mapping: resolved profile → projection row (values already canonical). */
export function creatorIntelligenceProjectionRow(
  profile: CreatorIntelligence
): CreatorIntelligenceProjectionRow {
  return {
    unified_id: profile.unifiedId,
    source_type: profile.sourceType,
    display_name: profile.displayName || null,
    platforms: profile.platforms,
    categories: profile.categories.value,
    category_source: profile.categories.source,
    category_confidence: profile.categories.confidence,
    niche: profile.niche.value,
    topics: profile.topics.value,
    languages: profile.languages.value,
    creator_tier: profile.creatorType.value,
    audience_countries: profile.audience.countries.value,
    audience_age_bucket: profile.audience.dominantAgeBucket.value,
    audience_gender_male: profile.audience.genderSplit.value?.male ?? null,
    audience_gender_female: profile.audience.genderSplit.value?.female ?? null,
    brand_safety_level: profile.brandSafety.level.value,
    max_followers: profile.metrics.maxFollowers,
    max_engagement_rate: profile.metrics.maxEngagementRate,
    thinkway_score: profile.scores.thinkway,
    resolved_at: profile.resolvedAt,
  };
}

/** Upsert a batch of resolved profiles into the projection table. */
export async function upsertCreatorIntelligenceProjection(
  supabase: SupabaseClient,
  profiles: ReadonlyArray<CreatorIntelligence>
): Promise<{ upserted: number; error?: string }> {
  if (profiles.length === 0) return { upserted: 0 };
  const rows = profiles.map(creatorIntelligenceProjectionRow);
  const { error } = await supabase
    .from("creator_intelligence")
    .upsert(rows, { onConflict: "unified_id" });
  if (error) return { upserted: 0, error: error.message };
  return { upserted: rows.length };
}
