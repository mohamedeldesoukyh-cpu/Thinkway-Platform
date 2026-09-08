/**
 * Strategy → CreatorSearchRequirements (CSR).
 *
 * Phase 1: builds the contract only. Nothing here reaches live creator search,
 * ranking, or slate membership.
 *
 * This is NOT an intelligence extractor. It reads already-validated Campaign
 * Intelligence and the already-written Campaign Strategy Document, and combines
 * them under a fixed precedence:
 *
 *   operator override  →  Strategy (campaign intent)
 *                      →  Validated Intelligence (extracted brief facts)
 *                      →  Campaign Facts / regex fallback
 *
 * Missing information is never invented — it is recorded in `gaps`.
 */

import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";
import type {
  BrandSafetyLevel,
  NormalizedGender,
} from "@/features/campaign-intelligence-profile/services/normalization/types";
import {
  normalizeGender,
  normalizePlatform,
} from "@/features/campaign-intelligence-profile/services/normalization/validators";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { normalizeInfluencerTier } from "@/lib/creators/influencer-tier";
import { resolveCanonicalCategory } from "@/lib/creator-intelligence/taxonomy";
import type { DiscoveryPlatform } from "@/lib/discovery/types";

import { deriveCreatorCategoriesFromBrief } from "../derive-creator-categories";
import { objectiveKindOf } from "../creator-quantity";
import {
  CREATOR_SEARCH_REQUIREMENTS_SCHEMA_VERSION,
  type CreatorRequirement,
  type CreatorRequirementGap,
  type CreatorSearchLayer,
  type CreatorSearchRequirements,
  type CreatorStrategicLayer,
  type RequirementSource,
  type RequirementTier,
} from "../../types/creator-search-requirements";

/** Operator overrides — Phase 1 supports the fields Studio can already edit. */
export type CreatorSearchRequirementsOverrides = {
  platforms?: string[];
  creatorCountries?: string[];
  audienceCountries?: string[];
  languages?: string[];
  primaryCategories?: string[];
  targetCreatorCount?: number;
};

export type BuildCreatorSearchRequirementsInput = {
  strategy?: CampaignStrategyDocument | null;
  validated?: ValidatedCampaignIntelligence | null;
  facts?: CampaignFacts | null;
  overrides?: CreatorSearchRequirementsOverrides;
  campaignIntelligenceProfileId?: string;
  /** Injectable for deterministic tests. */
  now?: string;
};

type Candidate = {
  value: string;
  source: RequirementSource;
  rationale: string;
  confidence: number;
};

const SOURCE_CONFIDENCE: Record<RequirementSource, number> = {
  operator: 1,
  strategy: 0.9,
  validated_intel: 0.85,
  facts: 0.7,
  brief_regex_fallback: 0.5,
};

function trimmedList(values: readonly (string | null | undefined)[] | undefined): string[] {
  return (values ?? [])
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

/**
 * Walk sources in precedence order and take the first that yields values.
 * Higher-precedence sources REPLACE lower ones rather than merging, so a
 * Strategy platform decision is not silently widened by extracted brief data.
 */
function firstNonEmpty(groups: Candidate[][]): Candidate[] {
  for (const group of groups) {
    if (group.length > 0) return group;
  }
  return [];
}

function candidatesFrom(
  values: readonly (string | null | undefined)[] | undefined,
  source: RequirementSource,
  rationale: string
): Candidate[] {
  return trimmedList(values).map((value) => ({
    value,
    source,
    rationale,
    confidence: SOURCE_CONFIDENCE[source],
  }));
}

function toRequirements(
  group: string,
  candidates: Candidate[],
  tier: RequirementTier,
  weight: number,
  discoveryKey?: CreatorRequirement["discoveryKey"],
  normalize: (value: string) => string | null = (value) => value
): CreatorRequirement[] {
  const seen = new Set<string>();
  const out: CreatorRequirement[] = [];
  for (const candidate of candidates) {
    const normalized = normalize(candidate.value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `${group}:${key}`,
      value: normalized,
      tier,
      weight,
      source: candidate.source,
      rationale: candidate.rationale,
      confidence: candidate.confidence,
      ...(discoveryKey ? { discoveryKey } : {}),
    });
  }
  return out;
}

function singleRequirement<V>(
  group: string,
  value: V | undefined,
  source: RequirementSource,
  rationale: string,
  tier: RequirementTier,
  weight: number,
  discoveryKey?: CreatorRequirement["discoveryKey"]
): CreatorRequirement<V> | undefined {
  if (value == null || value === "") return undefined;
  return {
    id: `${group}:${String(value).toLowerCase()}`,
    value,
    tier,
    weight,
    source,
    rationale,
    confidence: SOURCE_CONFIDENCE[source],
    ...(discoveryKey ? { discoveryKey } : {}),
  };
}

/** Content pillars carry campaign intent; the ones naming a vertical also seed categories. */
function categoriesFromPillars(strategy: CampaignStrategyDocument | null | undefined): Candidate[] {
  if (!strategy) return [];
  const out: Candidate[] = [];
  for (const pillar of strategy.pillars ?? []) {
    for (const token of [pillar.title, pillar.what]) {
      const canonical = resolveCanonicalCategory(token ?? "");
      if (!canonical) continue;
      out.push({
        value: canonical,
        source: "strategy",
        rationale: `Strategy pillar "${pillar.title}": ${pillar.why}`,
        confidence: SOURCE_CONFIDENCE.strategy,
      });
    }
  }
  return out;
}

function contentTopicsFromPillars(
  strategy: CampaignStrategyDocument | null | undefined
): Candidate[] {
  if (!strategy) return [];
  return (strategy.pillars ?? [])
    .map((pillar) => pillar.title?.trim())
    .filter((title): title is string => Boolean(title))
    .map((title) => ({
      value: title,
      source: "strategy" as const,
      rationale: "Derived from an approved Strategy content pillar.",
      confidence: SOURCE_CONFIDENCE.strategy,
    }));
}

function resolveBrandSafety(
  validated: ValidatedCampaignIntelligence | null | undefined
): BrandSafetyLevel {
  return validated?.brandSafety ?? "none";
}

function buildSearchLayer(input: BuildCreatorSearchRequirementsInput): {
  search: CreatorSearchLayer;
  gaps: CreatorRequirementGap[];
} {
  const { strategy, validated, facts, overrides } = input;
  const gaps: CreatorRequirementGap[] = [];

  // ---- platforms ----------------------------------------------------------
  const platformCandidates = firstNonEmpty([
    candidatesFrom(overrides?.platforms, "operator", "Operator-selected platform."),
    candidatesFrom(
      strategy?.understanding.platforms,
      "strategy",
      "Platform selected by the approved campaign strategy."
    ),
    candidatesFrom(validated?.platforms, "validated_intel", "Platform stated in the brief."),
    candidatesFrom(facts?.platforms, "facts", "Platform recorded in campaign facts."),
  ]);
  const platforms = toRequirements(
    "platform",
    platformCandidates,
    "mandatory",
    100,
    "platform",
    (value) => normalizePlatform(value)
  ) as CreatorRequirement<DiscoveryPlatform>[];
  if (platforms.length === 0) {
    gaps.push({
      field: "search.platforms",
      reason: "No platform stated by strategy, validated intelligence, or facts.",
      blocking: true,
    });
  }

  // ---- geography ----------------------------------------------------------
  const strategyGeography = strategy?.understanding.geography
    ? [strategy.understanding.geography]
    : [];
  const creatorCountryCandidates = firstNonEmpty([
    candidatesFrom(overrides?.creatorCountries, "operator", "Operator-selected market."),
    candidatesFrom(strategyGeography, "strategy", "Market defined by the campaign strategy."),
    candidatesFrom(
      validated?.market.countryCode ? [validated.market.countryCode] : [],
      "validated_intel",
      "Market stated in the brief."
    ),
    candidatesFrom(facts?.geography, "facts", "Market recorded in campaign facts."),
  ]);
  const creatorCountries = toRequirements(
    "creator_country",
    creatorCountryCandidates,
    "mandatory",
    90,
    "creator_country",
    (value) => resolveCountryCode(value) || null
  );

  const audienceCountryCandidates = firstNonEmpty([
    candidatesFrom(overrides?.audienceCountries, "operator", "Operator-selected audience market."),
    candidatesFrom(
      validated?.audience.countries,
      "validated_intel",
      "Audience market stated in the brief."
    ),
    candidatesFrom(strategyGeography, "strategy", "Audience market implied by campaign strategy."),
    candidatesFrom(facts?.geography, "facts", "Audience market recorded in campaign facts."),
  ]);
  const audienceCountries = toRequirements(
    "audience_country",
    audienceCountryCandidates,
    "mandatory",
    100,
    "audience_country",
    (value) => resolveCountryCode(value) || null
  );

  if (creatorCountries.length === 0 && audienceCountries.length === 0) {
    gaps.push({
      field: "search.geography",
      reason: "No creator or audience market could be resolved.",
      blocking: true,
    });
  }

  const cities = toRequirements(
    "audience_city",
    [
      ...candidatesFrom(validated?.market.cities, "validated_intel", "City stated in the brief."),
      ...candidatesFrom(
        validated?.audience.cities,
        "validated_intel",
        "Audience city stated in the brief."
      ),
    ],
    "preferred",
    85,
    "audience_city"
  );

  // ---- language -----------------------------------------------------------
  const languages = toRequirements(
    "language",
    firstNonEmpty([
      candidatesFrom(overrides?.languages, "operator", "Operator-selected language."),
      candidatesFrom(
        validated?.audience.languages,
        "validated_intel",
        "Language stated in the brief."
      ),
    ]),
    "mandatory",
    80,
    "language"
  );

  // ---- categories ---------------------------------------------------------
  // Strategy pillars and validated categories are BOTH primary sources; the
  // brief regex derivation is retained as a labelled fallback only.
  const strategyCategories = categoriesFromPillars(strategy);
  const validatedCategories = candidatesFrom(
    validated?.categories,
    "validated_intel",
    "Creator category confirmed during brief validation."
  );
  const operatorCategories = candidatesFrom(
    overrides?.primaryCategories,
    "operator",
    "Operator-selected creator category."
  );

  let primaryCandidates: Candidate[] = [
    ...operatorCategories,
    ...strategyCategories,
    ...validatedCategories,
  ];
  if (primaryCandidates.length === 0) {
    primaryCandidates = candidatesFrom(
      deriveCreatorCategoriesFromBrief({
        briefText: facts?.rawBriefExcerpt,
        objective: facts?.objective,
        audience: facts?.audience,
        campaignName: facts?.product,
        products: facts?.product ? [facts.product] : undefined,
      }),
      "brief_regex_fallback",
      "Inferred from brief keywords — no strategy or validated category available."
    );
    if (primaryCandidates.length > 0) {
      gaps.push({
        field: "search.primaryCategories",
        reason:
          "Categories fell back to brief keyword inference; strategy pillars and validated intelligence produced none.",
        blocking: false,
      });
    }
  }
  const primaryCategories = toRequirements(
    "category",
    primaryCandidates,
    "preferred",
    100,
    "category",
    (value) => resolveCanonicalCategory(value)
  );
  if (primaryCategories.length === 0) {
    gaps.push({
      field: "search.primaryCategories",
      reason: "No creator category could be resolved from any source.",
      blocking: true,
    });
  }

  const primaryKeys = new Set(primaryCategories.map((c) => c.value.toLowerCase()));
  const secondaryCategories = toRequirements(
    "secondary_category",
    validatedCategories.filter(
      (candidate) => !primaryKeys.has((resolveCanonicalCategory(candidate.value) ?? "").toLowerCase())
    ),
    "exploratory",
    60,
    "category",
    (value) => resolveCanonicalCategory(value)
  );

  // ---- niches / topics ----------------------------------------------------
  const niches = toRequirements(
    "niche",
    candidatesFrom(validated?.creator.niches, "validated_intel", "Niche stated in the brief."),
    "preferred",
    90,
    "niche"
  );
  const contentTopics = toRequirements(
    "content_keyword",
    [
      ...contentTopicsFromPillars(strategy),
      ...candidatesFrom(validated?.keywords, "validated_intel", "Keyword stated in the brief."),
    ],
    "preferred",
    70,
    "content_keyword"
  );

  // ---- audience demographics ---------------------------------------------
  const gender = validated?.audience.gender
    ? (normalizeGender(validated.audience.gender) ?? undefined)
    : undefined;
  const audienceGender =
    gender && gender !== "any"
      ? singleRequirement<NormalizedGender>(
          "audience_gender",
          gender,
          "validated_intel",
          "Audience gender stated in the brief.",
          "preferred",
          95,
          "audience_gender"
        )
      : undefined;

  const audienceAgeMin = singleRequirement<number>(
    "audience_age_min",
    validated?.audience.ageMin,
    "validated_intel",
    "Audience minimum age stated in the brief.",
    "preferred",
    90,
    "audience_age_min"
  );
  const audienceAgeMax = singleRequirement<number>(
    "audience_age_max",
    validated?.audience.ageMax,
    "validated_intel",
    "Audience maximum age stated in the brief.",
    "preferred",
    90,
    "audience_age_max"
  );

  // ---- reach / engagement guardrails --------------------------------------
  // Wide guardrails only. Per-tier follower windows are a portfolio decision
  // and stay in Layer 2 so a tier mix is not starved by a SQL filter.
  const followerFloor = singleRequirement<number>(
    "follower_min",
    validated?.creator.followerMin,
    "validated_intel",
    "Minimum reach stated in the brief.",
    "preferred",
    85,
    "follower_min"
  );
  const followerCeiling = singleRequirement<number>(
    "follower_max",
    validated?.creator.followerMax,
    "validated_intel",
    "Maximum reach stated in the brief.",
    "preferred",
    85,
    "follower_max"
  );
  const engagementFloor = singleRequirement<number>(
    "engagement_min",
    validated?.creator.engagementMin,
    "validated_intel",
    "Minimum engagement rate stated in the brief.",
    "preferred",
    75,
    "engagement_min"
  );

  // ---- exclusions ---------------------------------------------------------
  // Strategy constraints are captured verbatim. No Discovery allowlist key
  // exists for negative filters, so these stay unprojected in Phase 1.
  const exclusionKeywords = trimmedList(strategy?.understanding.constraints);

  return {
    search: {
      platforms,
      creatorCountries,
      audienceCountries,
      cities,
      languages,
      primaryCategories,
      secondaryCategories,
      niches,
      contentTopics,
      audienceGender,
      audienceAgeMin,
      audienceAgeMax,
      followerFloor,
      followerCeiling,
      engagementFloor,
      brandSafety: resolveBrandSafety(validated),
      exclusions: {
        creatorIds: [],
        handles: [],
        categories: [],
        keywords: exclusionKeywords,
        competitorBrands: [],
      },
    },
    gaps,
  };
}

function buildStrategicLayer(input: BuildCreatorSearchRequirementsInput): {
  strategic: CreatorStrategicLayer;
  gaps: CreatorRequirementGap[];
} {
  const { strategy, facts, overrides } = input;
  const gaps: CreatorRequirementGap[] = [];

  const objective = strategy?.understanding.objective?.trim() || facts?.objective?.trim() || "";
  if (!objective) {
    gaps.push({
      field: "strategic.objective",
      reason: "No campaign objective in strategy or facts.",
      blocking: true,
    });
  }

  const kpis = (strategy?.understanding.kpis ?? []).map((kpi) => ({
    metric: kpi.metric,
    target: kpi.target,
    why: kpi.why,
  }));
  if (kpis.length === 0) {
    gaps.push({
      field: "strategic.kpis",
      reason: "Strategy defined no KPIs.",
      blocking: false,
    });
  }

  const tierMix = (strategy?.creatorTierStrategy ?? [])
    .map((entry) => {
      const tier = normalizeInfluencerTier(entry.tier);
      if (!tier) return null;
      return { tier, percent: entry.allocationPercent, why: entry.why };
    })
    .filter((entry): entry is CreatorStrategicLayer["tierMix"][number] => entry !== null);
  if (tierMix.length === 0) {
    gaps.push({
      field: "strategic.tierMix",
      reason: "Strategy defined no creator tier allocation.",
      blocking: false,
    });
  }

  const contentPillars = (strategy?.pillars ?? []).map((pillar) => ({
    title: pillar.title,
    what: pillar.what,
    why: pillar.why,
  }));

  const contentFormats = toRequirements(
    "content_format",
    candidatesFrom(
      (strategy?.platformMix ?? []).map((entry) => entry.role),
      "strategy",
      "Content role defined by the strategy platform mix."
    ),
    "preferred",
    70
  );

  const audienceInterests = toRequirements(
    "audience_interest",
    candidatesFrom(
      strategy?.understanding.audience ? [strategy.understanding.audience] : facts?.audience ? [facts.audience] : [],
      strategy?.understanding.audience ? "strategy" : "facts",
      "Audience description used for interest matching."
    ),
    "preferred",
    70
  );

  return {
    strategic: {
      objective,
      objectiveKind: objectiveKindOf(objective || undefined),
      kpis,
      tierMix,
      // Archetypes are not modelled by Strategy today — later phase.
      archetypes: [],
      contentFormats,
      audienceInterests,
      contentPillars,
      coverage: {
        targetCreatorCount: overrides?.targetCreatorCount ?? null,
        minCategoriesCovered: 0,
        minPlatformsCovered: 0,
      },
      ...(facts?.budget ? { budget: facts.budget } : {}),
    },
    gaps,
  };
}

/**
 * Build the CSR contract. Pure and synchronous — callers supply whatever
 * Strategy / validated intelligence / facts they already hold.
 */
export function buildCreatorSearchRequirements(
  input: BuildCreatorSearchRequirementsInput
): CreatorSearchRequirements {
  const { search, gaps: searchGaps } = buildSearchLayer(input);
  const { strategic, gaps: strategicGaps } = buildStrategicLayer(input);

  const gaps = [...searchGaps, ...strategicGaps];
  if (!input.strategy) {
    gaps.unshift({
      field: "strategyRef",
      reason: "No Campaign Strategy Document available — requirements fall back to brief intelligence.",
      blocking: true,
    });
  }

  return {
    schemaVersion: CREATOR_SEARCH_REQUIREMENTS_SCHEMA_VERSION,
    ...(input.strategy
      ? {
          strategyRef: {
            id: input.strategy.id,
            version: input.strategy.version,
            createdAt: input.strategy.createdAt,
          },
        }
      : {}),
    ...(input.campaignIntelligenceProfileId
      ? { campaignIntelligenceProfileId: input.campaignIntelligenceProfileId }
      : {}),
    generatedAt: input.now ?? new Date().toISOString(),
    search,
    strategic,
    fieldEvidence: input.validated?.fieldEvidence ?? {},
    gaps,
  };
}
