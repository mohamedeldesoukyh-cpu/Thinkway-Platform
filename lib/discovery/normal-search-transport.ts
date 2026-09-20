import { COUNTRY_ALIASES, resolveCountryCode } from "@/lib/creators/country-code";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { resolveCreatorSearchFollowerRanges, toBrowseFollowerRanges } from "@/lib/creators/follower-range-filter";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeNormalSearch, normalRetrievalQuery, sanitizeNormalFilters, type Candidate, type NormalSearchRequest } from "./normal-search";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

/** No write-capable callbacks. The only network capability used here is the read-only RPC. */
export async function runNormalSearchTransport(client: Pick<SupabaseClient, "rpc">, request: NormalSearchRequest) {
  const f = sanitizeNormalFilters(request.filters);
  const countryCodes = f.countries.map(resolveCountryCode);
  const countryValues = [...countryCodes, ...COUNTRY_OPTIONS.filter(c => countryCodes.includes(c.value)).map(c => c.label), ...Object.keys(COUNTRY_ALIASES).filter(k => countryCodes.includes(COUNTRY_ALIASES[k]))].map(v => v.toLowerCase());
  const numeric = (v: string) => v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;
  const databaseFilters = {
    countries: countryCodes, countryValues, categories: f.categories.map(c => c.trim().toLowerCase()),
    platforms: f.platforms.map(canonicalPlatformKey), ranges: toBrowseFollowerRanges(resolveCreatorSearchFollowerRanges(f)),
    minEngagement: numeric(f.minEngagement), minViews: numeric(f.minViews),
    languages: f.languages.map(v => v.toLowerCase()), minThinkway: numeric(f.minThinkwayScore),
  };
  return executeNormalSearch(request, async (offset, limit) => {
    const { data, error } = await client.rpc("discovery_normal_candidate_window", {
      p_filters: databaseFilters, p_query: normalRetrievalQuery(f), p_offset: offset, p_limit: limit,
      p_content: Boolean(request.filters.contentKeyword || request.filters.contentTags.length),
      p_dates: Boolean(request.filters.lastPostWithin),
    });
    if (error) throw new Error(error.code === "PGRST202" ? "Discovery Phase 1 requires its reviewed database migration. No legacy search fallback was executed." : error.message);
    const window = data as { items: Partial<Candidate>[]; exhausted: boolean; scannedCount?: number };
    if (!Array.isArray(window?.items) || typeof window.exhausted !== "boolean") throw new Error("Invalid Discovery candidate response");
    return { exhausted: window.exhausted, scannedCount: window.scannedCount, candidates: window.items.map(candidateFromProjection) };
  });
}
export function candidateFromProjection(row: Partial<Candidate>): Candidate {
  const metric = { value: null, confidence: "estimated" as const };
  const base: UnifiedCreatorResult = {
    unified_id: "", source_type: "internal", influencer_id: null, discovered_profile_id: null,
    document_number: null, display_name: "", status: null, country_code: null, estimated_country: null, city: null,
    categories: [], language_codes: [], profile_image_url: null, bio: null,
    metrics: { followers: metric, engagement_rate: metric, avg_likes: metric, avg_comments: metric, avg_views: metric, posting_frequency_per_week: metric },
    ai_category: null, ai_niche: null, authenticity_score: null, thinkway_score: 0, source_confidence: 0,
    brand_fit_score: null, is_platform_verified: false, platforms: [],
  };
  return { ...base, ...row, categories: row.categories ?? [], language_codes: row.language_codes ?? [], platforms: row.platforms ?? [], thinkway_score: row.thinkway_score ?? 0 };
}
