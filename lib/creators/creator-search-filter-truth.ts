/**
 * Creator Search Filter Truth Contract (Phase 0).
 *
 * A filter may only appear actionable when it can be enforced correctly against
 * Thinkway source-of-truth data. Classifications:
 *
 * - ENFORCED — applied on the server retrieval / post-browse path
 * - ENFORCED_WITH_REQUIRED_DATA — enforced when required fields are hydrated
 * - UNSUPPORTED — cannot be enforced correctly yet (must not look active)
 * - UI_DISABLED — intentionally unavailable in the UI
 */

import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

/** Minimal shape — avoids importing UI filter module into lib/. */
export type CreatorSearchClientOnlyFilterInput = {
  handle: string;
  aiNiche: string;
  minBrandSafety: string;
};

export type CreatorSearchFilterTruthClass =
  | "ENFORCED"
  | "ENFORCED_WITH_REQUIRED_DATA"
  | "UNSUPPORTED"
  | "UI_DISABLED";

export type CreatorSearchFilterTruthRow = {
  filter: string;
  classification: CreatorSearchFilterTruthClass;
  uiState: "active" | "disabled" | "approximate";
  canonicalSource: string;
  side: "server" | "client" | "server+client" | "none";
  notes: string;
  phase1Dependency?: string;
};

/** Static Phase 0 contract — keep in sync with docs/DISCOVERY_SEARCH_FILTER_TRUTH_MATRIX.md */
export const CREATOR_SEARCH_FILTER_TRUTH_MATRIX: CreatorSearchFilterTruthRow[] = [
  {
    filter: "search (q)",
    classification: "ENFORCED",
    uiState: "active",
    canonicalSource: "search_creators RPC / influencer + platform identity fields",
    side: "server",
    notes: "Lexical FTS + trigram tiers",
  },
  {
    filter: "handle chip",
    classification: "ENFORCED",
    uiState: "approximate",
    canonicalSource: "FTS search string + primary platform handle",
    side: "server+client",
    notes: "Merged into FTS; client re-checks primary handle substring",
    phase1Dependency: "Unify handle semantics server-side across all platforms",
  },
  {
    filter: "platforms",
    classification: "ENFORCED",
    uiState: "active",
    canonicalSource: "influencer_platform_accounts.platform",
    side: "server",
    notes: "OR within; single platform SQL, multi post-filter (page underfill Phase 1)",
    phase1Dependency: "ID-stage multi-platform SQL",
  },
  {
    filter: "categories",
    classification: "ENFORCED",
    uiState: "active",
    canonicalSource: "influencers.categories (+ CI union when mode on)",
    side: "server",
    notes: "OR within categories",
  },
  {
    filter: "countries",
    classification: "ENFORCED",
    uiState: "active",
    canonicalSource: "influencers.country_code / country_codes",
    side: "server",
    notes: "OR within; first country SQL, rest post-filter (underfill Phase 1)",
    phase1Dependency: "ID-stage multi-country SQL",
  },
  {
    filter: "languages",
    classification: "ENFORCED_WITH_REQUIRED_DATA",
    uiState: "active",
    canonicalSource: "influencers.languages → language_codes",
    side: "server",
    notes: "OR within; hydrated when language filters active; missing codes do not match",
  },
  {
    filter: "contentLanguages",
    classification: "ENFORCED_WITH_REQUIRED_DATA",
    uiState: "active",
    canonicalSource: "influencers.languages → language_codes (no separate content corpus)",
    side: "server",
    notes: "Same language_codes field until a dedicated content-language SSOT exists",
  },
  {
    filter: "audienceCountries",
    classification: "ENFORCED_WITH_REQUIRED_DATA",
    uiState: "active",
    canonicalSource: "audience demographics / platform audience_country / creator country fallback",
    side: "server",
    notes: "May fall back to creator country when audience graph sparse",
  },
  {
    filter: "audience gender",
    classification: "ENFORCED_WITH_REQUIRED_DATA",
    uiState: "active",
    canonicalSource: "influencers.audience_gender_*",
    side: "server",
    notes: "Demographics hydrated only when filter set; missing data excludes",
  },
  {
    filter: "audience age",
    classification: "ENFORCED_WITH_REQUIRED_DATA",
    uiState: "active",
    canonicalSource: "influencers.audience_age_*",
    side: "server",
    notes: "Demographics hydrated only when filter set; missing data excludes",
  },
  {
    filter: "audience interests",
    classification: "ENFORCED",
    uiState: "active",
    canonicalSource: "categories / ai_niche / audience_interests haystack",
    side: "server",
    notes: "OR substring match",
  },
  {
    filter: "min/max followers",
    classification: "ENFORCED",
    uiState: "active",
    canonicalSource: "influencer_platform_accounts.follower_count",
    side: "server",
    notes: "Account prefilter + metrics",
  },
  {
    filter: "min engagement",
    classification: "ENFORCED",
    uiState: "active",
    canonicalSource: "influencer_platform_accounts.engagement_rate",
    side: "server",
    notes: "Account prefilter",
  },
  {
    filter: "min views",
    classification: "ENFORCED_WITH_REQUIRED_DATA",
    uiState: "active",
    canonicalSource: "influencer_platform_accounts.avg_views",
    side: "server",
    notes: "Null avg_views excludes; no approximation",
  },
  {
    filter: "min Thinkway score",
    classification: "ENFORCED",
    uiState: "active",
    canonicalSource: "influencers.thinkway_score",
    side: "server",
    notes: "Post-map / post-filter",
  },
  {
    filter: "last post within",
    classification: "ENFORCED_WITH_REQUIRED_DATA",
    uiState: "active",
    canonicalSource: "recent_publications[].posted_at (canonical publication timestamp)",
    side: "server",
    notes: "posted_at projected when filter set; missing dates exclude; never uses last_enriched_at",
  },
  {
    filter: "pricing (estimated cost)",
    classification: "UI_DISABLED",
    uiState: "disabled",
    canonicalSource: "influencers.rate_card (unstructured; not Search-indexed)",
    side: "none",
    notes: "Rate card not reliable for catalog filter; UI disabled in Phase 0",
    phase1Dependency: "Normalized commercial rate index",
  },
  {
    filter: "verification",
    classification: "UI_DISABLED",
    uiState: "disabled",
    canonicalSource: "platform is_verified",
    side: "none",
    notes: "Coming soon control",
  },
  {
    filter: "aiNiche / brand safety",
    classification: "ENFORCED",
    uiState: "approximate",
    canonicalSource: "ai_niche / authenticity_score / brand_fit_score",
    side: "client",
    notes: "Client-only; pagination approximate until Phase 1 page-fill",
    phase1Dependency: "Server-side enforcement + page fill",
  },
];

export type BrowseHydrationExtras = {
  includeLanguages: boolean;
  includeDemographics: boolean;
  includePublicationDates: boolean;
};

/** Extra slim-browse columns required when specific filters are active. */
export function resolveBrowseHydrationExtras(
  filters: Pick<
    UnifiedCreatorBrowseFilters,
    | "language"
    | "languages"
    | "contentLanguages"
    | "audienceGender"
    | "audienceAgeMin"
    | "audienceAgeMax"
    | "lastPostWithin"
  >
): BrowseHydrationExtras {
  return {
    includeLanguages: Boolean(
      filters.language?.trim() ||
        (filters.languages?.length ?? 0) > 0 ||
        (filters.contentLanguages?.length ?? 0) > 0
    ),
    includeDemographics: Boolean(
      filters.audienceGender?.trim() ||
        filters.audienceAgeMin?.trim() ||
        filters.audienceAgeMax?.trim()
    ),
    includePublicationDates: Boolean(filters.lastPostWithin?.trim()),
  };
}

/** Filters still applied only in the browser after Phase 0 server moves. */
export function listClientOnlyCreatorSearchFilterKeys(
  filters: CreatorSearchClientOnlyFilterInput
): string[] {
  const keys: string[] = [];
  if (filters.handle.trim()) keys.push("handle");
  if (filters.aiNiche.trim()) keys.push("aiNiche");
  if (filters.minBrandSafety.trim()) keys.push("minBrandSafety");
  return keys;
}

export function creatorSearchPricingFilterSupported(): boolean {
  return false;
}
