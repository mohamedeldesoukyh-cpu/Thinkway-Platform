import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AudienceDemographicFact,
  AudienceEngagementFact,
  CreatorAudienceFacts,
} from "@/lib/enterprise-creator-intelligence/audience/compute";
import { loadCreatorMonthlyMetrics } from "@/lib/enterprise-creator-intelligence/historical/load-monthly";
import { computeCreatorPerformanceIntelligence } from "@/lib/enterprise-creator-intelligence/performance/compute";
import { loadCreatorPerformanceFacts } from "@/lib/enterprise-creator-intelligence/performance/load-facts";
import { isMissingTableError } from "@/lib/platform/schema-validation";

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Load audience facts from influencer demographics, Sprint 1 growth, and Sprint 4 engagement.
 */
export async function loadCreatorAudienceFacts(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
  }
): Promise<CreatorAudienceFacts> {
  const influencerId = input.influencerId;

  const [influencerResult, dnaResult, monthly, performanceFacts] =
    await Promise.all([
      supabase
        .from("influencers")
        .select(
          `
          audience_age_13_17, audience_age_18_24, audience_age_25_34,
          audience_age_35_44, audience_age_45_54, audience_age_55_plus,
          audience_gender_male, audience_gender_female, audience_gender_unknown,
          audience_top_countries, audience_top_cities, demographic_source
        `
        )
        .eq("id", influencerId)
        .maybeSingle(),
      supabase
        .from("creator_dna")
        .select("audience, scores")
        .eq("influencer_id", influencerId)
        .maybeSingle(),
      loadCreatorMonthlyMetrics(supabase, {
        influencerId,
        platform: input.platform,
        limitMonths: 36,
      }),
      loadCreatorPerformanceFacts(supabase, {
        influencerId,
        platform: input.platform,
      }).catch(() => null),
    ]);

  if (
    influencerResult.error &&
    !isMissingTableError(
      influencerResult.error.message,
      influencerResult.error.code
    )
  ) {
    throw new Error(influencerResult.error.message);
  }

  const row = (influencerResult.data ?? {}) as Record<string, unknown>;
  const dna = (dnaResult.data ?? null) as {
    audience?: Record<string, unknown> | null;
    scores?: Record<string, unknown> | null;
  } | null;

  const dnaAudience = dna?.audience ?? {};
  const languagesRaw =
    (dnaAudience.languages as unknown) ??
    (dnaAudience.languagePrimary ? [dnaAudience.languagePrimary] : []);
  const languages = Array.isArray(languagesRaw)
    ? languagesRaw.map((l) => String(l)).filter(Boolean)
    : typeof languagesRaw === "string"
      ? [languagesRaw]
      : [];

  const authenticityScore =
    num(dna?.scores?.authenticityScore) ??
    num(dna?.scores?.authenticity_score);

  const demographics: AudienceDemographicFact = {
    genderMale: num(row.audience_gender_male),
    genderFemale: num(row.audience_gender_female),
    genderUnknown: num(row.audience_gender_unknown),
    age13_17: num(row.audience_age_13_17),
    age18_24: num(row.audience_age_18_24),
    age25_34: num(row.audience_age_25_34),
    age35_44: num(row.audience_age_35_44),
    age45_54: num(row.audience_age_45_54),
    age55Plus: num(row.audience_age_55_plus),
    topCountries: (row.audience_top_countries as AudienceDemographicFact["topCountries"]) ?? null,
    topCities: (row.audience_top_cities as AudienceDemographicFact["topCities"]) ?? null,
    demographicSource: str(row.demographic_source),
    languages,
    authenticityScore,
  };

  let engagement: AudienceEngagementFact = {
    shareTrend: null,
    saveTrend: null,
    interactionTrend: null,
    engagementTrend: null,
    stabilityHint: null,
  };

  if (performanceFacts) {
    const performance = computeCreatorPerformanceIntelligence(performanceFacts);
    const byKey = Object.fromEntries(
      performance.audienceResponse.map((r) => [r.key, r.trend])
    );
    engagement = {
      shareTrend: byKey.share_trend ?? null,
      saveTrend: byKey.save_trend ?? null,
      interactionTrend: byKey.interaction_trend ?? null,
      engagementTrend: byKey.engagement_trend ?? null,
      stabilityHint: performance.stability.level,
    };
  }

  return {
    influencerId,
    platform: input.platform ?? monthly.platform,
    demographics,
    monthlyMetrics: monthly.months,
    engagement,
  };
}
