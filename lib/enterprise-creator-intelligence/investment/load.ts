import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCreatorAudienceIntelligence } from "@/lib/enterprise-creator-intelligence/audience/load";
import { loadCreatorCategoryBrandIntelligence } from "@/lib/enterprise-creator-intelligence/category-brand/load";
import { loadCreatorCommercialIntelligence } from "@/lib/enterprise-creator-intelligence/commercial/load-commercial";
import { loadCreatorMonthlyMetrics } from "@/lib/enterprise-creator-intelligence/historical/load-monthly";
import {
  computeCreatorInvestmentIntelligence,
  type CreatorInvestmentFacts,
} from "@/lib/enterprise-creator-intelligence/investment/compute";
import { appendInvestmentIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/investment/persist";
import type {
  CreatorInvestmentAiHints,
  CreatorInvestmentIntelligence,
} from "@/lib/enterprise-creator-intelligence/investment/types";
import { loadCreatorPerformanceIntelligence } from "@/lib/enterprise-creator-intelligence/performance/load";

/**
 * Load Sprint 1–5 layers (or accept overrides), compose Investment Intelligence.
 * Never redesigns or recalculates prior layer engines.
 */
export async function loadCreatorInvestmentIntelligence(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
    persistCapture?: boolean;
    factsOverride?: CreatorInvestmentFacts;
  }
): Promise<CreatorInvestmentIntelligence> {
  if (input.factsOverride) {
    const current = computeCreatorInvestmentIntelligence(input.factsOverride);
    if (input.persistCapture) {
      await appendInvestmentIntelligenceCapture(supabase, current);
    }
    return current;
  }

  const platform = input.platform ?? null;

  const [
    historicalSeries,
    commercialResult,
    categoryBrandResult,
    performance,
    audience,
  ] = await Promise.all([
    loadCreatorMonthlyMetrics(supabase, {
      influencerId: input.influencerId,
      platform,
    }).catch(() => ({
      influencerId: input.influencerId,
      platform,
      months: [],
    })),
    loadCreatorCommercialIntelligence(supabase, {
      influencerId: input.influencerId,
      platform,
    }).catch(() => null),
    loadCreatorCategoryBrandIntelligence(supabase, {
      influencerId: input.influencerId,
      platform,
    }).catch(() => null),
    loadCreatorPerformanceIntelligence(supabase, {
      influencerId: input.influencerId,
      platform,
    }).catch(() => null),
    loadCreatorAudienceIntelligence(supabase, {
      influencerId: input.influencerId,
      platform,
    }).catch(() => null),
  ]);

  const commercial = commercialResult?.current ?? null;
  const categoryBrand = categoryBrandResult?.current ?? null;

  const facts: CreatorInvestmentFacts = {
    influencerId: input.influencerId,
    platform:
      platform ??
      commercial?.platform ??
      performance?.platform ??
      audience?.platform ??
      categoryBrand?.platform ??
      historicalSeries.platform ??
      null,
    computedAt: new Date().toISOString(),
    historicalMonthly: historicalSeries.months,
    commercial,
    categoryBrand,
    performance,
    audience,
  };

  const current = computeCreatorInvestmentIntelligence(facts);

  if (input.persistCapture) {
    await appendInvestmentIntelligenceCapture(supabase, current);
  }

  return current;
}

export function buildInvestmentAiHints(
  intelligence: CreatorInvestmentIntelligence
): CreatorInvestmentAiHints {
  return intelligence.aiHints;
}
