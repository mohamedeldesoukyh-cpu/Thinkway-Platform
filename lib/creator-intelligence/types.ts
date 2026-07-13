/**
 * Creator Intelligence — the canonical semantic representation of a creator.
 *
 * One profile shape for every creator regardless of origin (internal
 * influencer, public discovery, oauth verified). Every semantic attribute is
 * wrapped in an envelope carrying WHERE the value came from, HOW confident we
 * are, and WHEN it was resolved — so filtering, ranking, and display can all
 * reason about trust and freshness instead of silently mixing provenance with
 * intelligence.
 *
 * Deliberately NOT a replacement for UnifiedCreatorResult: that remains the
 * data read-model (identity, metrics, avatars, platforms). CreatorIntelligence
 * is the resolved SEMANTIC layer on top of it — the only thing filtering,
 * matching, and ranking may consult for categories/topics/language/audience/
 * brand-safety decisions.
 */
import type { BrandSafetyLevel } from "./taxonomy";

/** Where an attribute value was resolved from (precedence order, best first). */
export type IntelligenceSource =
  | "creator_dna"
  | "ai_enrichment"
  | "bio_inference"
  | "platform_metrics"
  | "declared"
  | "unresolved";

/** An attribute value + its resolution metadata. */
export type IntelligenceAttribute<T> = {
  value: T;
  source: IntelligenceSource;
  /** 0..1 — how much downstream consumers should trust this value. */
  confidence: number;
};

export type CreatorAudienceIntelligence = {
  /** ISO-2 country the audience is concentrated in (creator country as proxy when audience data absent). */
  primaryCountry: IntelligenceAttribute<string | null>;
  /** Audience interest tags (normalized topics). */
  interests: IntelligenceAttribute<string[]>;
  /** True when real audience demographics (age/gender splits) are available. */
  hasDemographics: boolean;
};

export type CreatorBrandSafetyIntelligence = {
  level: IntelligenceAttribute<BrandSafetyLevel>;
  /** Human-readable signals behind the level (verification, authenticity, flags). */
  signals: string[];
};

export type CreatorIntelligence = {
  /** Stable composite key (`inf:uuid` / `dis:uuid`) — same as UnifiedCreatorResult.unified_id. */
  unifiedId: string;
  sourceType: string;
  displayName: string;
  /** Canonical platform slugs this creator is active on. */
  platforms: string[];

  /** Canonical category labels — the ONLY category field consumers may filter on. */
  categories: IntelligenceAttribute<string[]>;
  /** Finer-grained niche (single label) when known. */
  niche: IntelligenceAttribute<string | null>;
  /** Normalized content topics/themes (from hashtags, AI themes). */
  topics: IntelligenceAttribute<string[]>;
  /** ISO 639-1 content languages. */
  languages: IntelligenceAttribute<string[]>;
  audience: CreatorAudienceIntelligence;
  brandSafety: CreatorBrandSafetyIntelligence;

  /** Metric summary used by matching (never re-derived by consumers). */
  metrics: {
    maxFollowers: number | null;
    maxEngagementRate: number | null;
  };
  scores: {
    thinkway: number | null;
    brandFit: number | null;
    authenticity: number | null;
  };
  /** ISO timestamp of resolution (profiles are point-in-time snapshots). */
  resolvedAt: string;
};

/** Per-dimension outcome when matching a creator against campaign requirements. */
export type MatchEvaluation = "match" | "no_match" | "unknown";

export type MatchDimension =
  | "platform"
  | "country"
  | "category"
  | "topic"
  | "language"
  | "followers"
  | "engagement"
  | "brand_safety";

export type CreatorMatchBreakdown = {
  dimension: MatchDimension;
  evaluation: MatchEvaluation;
  reason: string;
};

export type CreatorMatch = {
  unifiedId: string;
  /** 0..100 — matched / (known + discount × unknown), scaled. */
  score: number;
  /** True when no requirement dimension evaluated to no_match. */
  eligible: boolean;
  breakdown: CreatorMatchBreakdown[];
  intelligence: CreatorIntelligence;
};

/** What a campaign requires of creators — derived from Campaign Intelligence (CampaignFacts). */
export type CampaignRequirements = {
  platforms?: string[];
  country?: string;
  categories?: string[];
  topics?: string[];
  languages?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  minEngagementRate?: number;
  /** Strictest acceptable brand-safety level; unknown never passes. */
  brandSafetyMinimum?: "safe" | "low_risk" | "moderate_risk" | "high_risk";
};
