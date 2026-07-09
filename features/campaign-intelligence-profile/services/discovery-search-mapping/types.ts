/**
 * Canonical Discovery Search filters — only fields the browse engine supports.
 * Campaign Intelligence may hold dozens of fields; this is the allowlist for Discovery.
 */

export const DISCOVERY_SEARCH_FILTER_KEYS = [
  "creator_country",
  "creator_city",
  "audience_country",
  "audience_city",
  "creator_gender",
  "creator_age_min",
  "creator_age_max",
  "audience_gender",
  "audience_age_min",
  "audience_age_max",
  "language",
  "category",
  "niche",
  "platform",
  "follower_min",
  "follower_max",
  "engagement_min",
  "engagement_max",
  "content_keyword",
  "content_tag",
  "verified",
  "brand_safety_min",
  "brand_fit_min",
] as const;

export type DiscoverySearchFilterKey = (typeof DISCOVERY_SEARCH_FILTER_KEYS)[number];

/** CIP fields that must never become Discovery filters. */
export const CIP_FIELDS_EXCLUDED_FROM_DISCOVERY = [
  "brandName",
  "clientName",
  "campaignName",
  "campaignType",
  "objective",
  "objectives",
  "deliverables",
  "budget",
  "durationWeeks",
  "kpis",
  "products",
  "constraints",
  "risks",
  "rawBriefExcerpt",
  "expectedCreatorCount",
  "toneOfVoice",
  "industry",
] as const;

export type DiscoveryMappedFilter = {
  id: string;
  key: DiscoverySearchFilterKey;
  /** Human-readable chip label, e.g. "Audience Country". */
  label: string;
  value: string;
  /** Display weight (IDH-style %), optional. */
  weight: number;
  /** Mapper confidence 0–1; filters below threshold are dropped. */
  confidence: number;
};

export type DiscoverySearchMappingResult = {
  filters: DiscoveryMappedFilter[];
  /** Field labels considered but skipped (low confidence or unmappable). */
  skipped: string[];
};
