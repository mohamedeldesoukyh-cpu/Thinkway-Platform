/**
 * Enterprise Creator Intelligence — Platform Consumer SSOT (G1)
 *
 * Planning · Client · Campaign · Reporting · Analytics · AI · Mobile
 * must consume Creator Intelligence ONLY through this facade.
 *
 * Discovery Thinkway Score / legacy ranking / campaign-decision simulators
 * are NOT Enterprise Creator Intelligence and must not be used as investment SSOT.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { computeCreatorAudienceIntelligence } from "@/lib/enterprise-creator-intelligence/audience/compute";
import { loadCreatorAudienceFacts } from "@/lib/enterprise-creator-intelligence/audience/load-facts";
import type { CreatorAudienceIntelligence } from "@/lib/enterprise-creator-intelligence/audience/types";
import { computeCreatorCategoryBrandIntelligence } from "@/lib/enterprise-creator-intelligence/category-brand/compute";
import { loadCreatorCategoryBrandFacts } from "@/lib/enterprise-creator-intelligence/category-brand/load-facts";
import type { CreatorCategoryBrandIntelligence } from "@/lib/enterprise-creator-intelligence/category-brand/types";
import { computeCreatorCommercialIntelligence } from "@/lib/enterprise-creator-intelligence/commercial/compute";
import { loadCreatorCommercialFacts } from "@/lib/enterprise-creator-intelligence/commercial/load-facts";
import type { CreatorCommercialIntelligence } from "@/lib/enterprise-creator-intelligence/commercial/types";
import { loadCreatorMonthlyMetrics } from "@/lib/enterprise-creator-intelligence/historical/load-monthly";
import type { CreatorHistoricalMonthlySeries } from "@/lib/enterprise-creator-intelligence/historical/types";
import { computeCreatorInvestmentIntelligence } from "@/lib/enterprise-creator-intelligence/investment/compute";
import type { CreatorInvestmentIntelligence } from "@/lib/enterprise-creator-intelligence/investment/types";
import { computeCreatorPerformanceIntelligence } from "@/lib/enterprise-creator-intelligence/performance/compute";
import { loadCreatorPerformanceFacts } from "@/lib/enterprise-creator-intelligence/performance/load-facts";
import type { CreatorPerformanceIntelligence } from "@/lib/enterprise-creator-intelligence/performance/types";
import {
  createEciFactsCache,
  type EciFactsCache,
  type EciFactsCacheStats,
} from "@/lib/enterprise-creator-intelligence/shared/facts-cache";
import { ECI_PLATFORM_CONSUMERS } from "@/lib/enterprise-creator-intelligence/ssot-policy";

/** One immutable Creator Intelligence object for all platform consumers. */
export type CreatorIntelligenceBundle = {
  influencerId: string;
  platform: string | null;
  computedAt: string;
  historical: CreatorHistoricalMonthlySeries;
  commercial: CreatorCommercialIntelligence;
  categoryBrand: CreatorCategoryBrandIntelligence;
  performance: CreatorPerformanceIntelligence;
  audience: CreatorAudienceIntelligence;
  investment: CreatorInvestmentIntelligence;
  /** Declared consumers — all must read this same object. */
  consumers: readonly string[];
  cacheStats?: EciFactsCacheStats;
};

/**
 * Canonical SSOT loader — compute each layer once via shared cache, then compose Investment.
 * Calculations are unchanged; cache only prevents recomputation.
 */
export async function loadCreatorIntelligenceBundle(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
    cache?: EciFactsCache;
  }
): Promise<CreatorIntelligenceBundle> {
  const cache = input.cache ?? createEciFactsCache();
  const influencerId = input.influencerId;
  const platform = input.platform ?? null;

  return cache.getOrCompute(
    "intelligence_bundle",
    influencerId,
    platform,
    async () => {
      const [historical, commercialFacts, categoryFacts, performanceFacts, audienceFacts] =
        await Promise.all([
          loadCreatorMonthlyMetrics(supabase, {
            influencerId,
            platform,
            cache,
          }),
          loadCreatorCommercialFacts(supabase, {
            influencerId,
            platform,
            cache,
          }),
          loadCreatorCategoryBrandFacts(supabase, {
            influencerId,
            platform,
            cache,
          }),
          loadCreatorPerformanceFacts(supabase, {
            influencerId,
            platform,
            cache,
          }),
          loadCreatorAudienceFacts(supabase, {
            influencerId,
            platform,
            cache,
          }),
        ]);

      const commercial = await cache.getOrCompute(
        "commercial_intelligence",
        influencerId,
        platform,
        () => computeCreatorCommercialIntelligence(commercialFacts)
      );

      const categoryBrand = await cache.getOrCompute(
        "category_brand_intelligence",
        influencerId,
        platform,
        () => computeCreatorCategoryBrandIntelligence(categoryFacts)
      );

      const performance = await cache.getOrCompute(
        "performance_intelligence",
        influencerId,
        platform,
        () => computeCreatorPerformanceIntelligence(performanceFacts)
      );

      const audience = await cache.getOrCompute(
        "audience_intelligence",
        influencerId,
        platform,
        () => computeCreatorAudienceIntelligence(audienceFacts)
      );

      const resolvedPlatform =
        platform ??
        commercial.platform ??
        performance.platform ??
        audience.platform ??
        categoryBrand.platform ??
        historical.platform ??
        null;

      const computedAt = new Date().toISOString();

      const investment = await cache.getOrCompute(
        "investment_intelligence",
        influencerId,
        resolvedPlatform,
        () =>
          computeCreatorInvestmentIntelligence({
            influencerId,
            platform: resolvedPlatform,
            computedAt,
            historicalMonthly: historical.months,
            commercial,
            categoryBrand,
            performance,
            audience,
          })
      );

      return {
        influencerId,
        platform: resolvedPlatform,
        computedAt,
        historical,
        commercial,
        categoryBrand,
        performance,
        audience,
        investment,
        consumers: ECI_PLATFORM_CONSUMERS,
        cacheStats: cache.stats(),
      };
    }
  );
}

/**
 * Batch loader for Planning (100–1000+ creators).
 * One shared cache across the batch — compute once per creator, reuse everywhere.
 */
export async function loadCreatorIntelligenceBundles(
  supabase: SupabaseClient,
  input: {
    influencerIds: string[];
    platform?: string | null;
    concurrency?: number;
    cache?: EciFactsCache;
  }
): Promise<{
  bundles: CreatorIntelligenceBundle[];
  cacheStats: EciFactsCacheStats;
}> {
  const cache = input.cache ?? createEciFactsCache();
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 8, 32));
  const ids = [...new Set(input.influencerIds.filter(Boolean))];
  const bundles: CreatorIntelligenceBundle[] = [];

  for (let i = 0; i < ids.length; i += concurrency) {
    const slice = ids.slice(i, i + concurrency);
    const batch = await Promise.all(
      slice.map((influencerId) =>
        loadCreatorIntelligenceBundle(supabase, {
          influencerId,
          platform: input.platform,
          cache,
        })
      )
    );
    bundles.push(...batch);
  }

  return { bundles, cacheStats: cache.stats() };
}

/** Verify two consumers received the identical investment recommendation object. */
export function assertSameCreatorIntelligenceObject(
  a: CreatorIntelligenceBundle,
  b: CreatorIntelligenceBundle
): boolean {
  return (
    a.influencerId === b.influencerId &&
    a.investment.overallScore === b.investment.overallScore &&
    a.investment.recommendation.recommendation ===
      b.investment.recommendation.recommendation &&
    a.investment.recommendation.confidence.percent ===
      b.investment.recommendation.confidence.percent &&
    a.investment.evidenceCoverage.percent ===
      b.investment.evidenceCoverage.percent &&
    a.commercial.evidenceCoverage.percent ===
      b.commercial.evidenceCoverage.percent &&
    a.audience.evidenceCoverage.percent === b.audience.evidenceCoverage.percent
  );
}
