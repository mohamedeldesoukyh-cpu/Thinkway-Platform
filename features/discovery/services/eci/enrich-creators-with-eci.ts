/**
 * Discovery × Enterprise Creator Intelligence — consume-only enrichment.
 *
 * Card / Detail / Compare investment display SSOT comes from
 * loadCreatorIntelligenceBundles only. Never invents scores.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createEciFactsCache,
  loadCreatorIntelligenceBundles,
  type CreatorIntelligenceBundle,
} from "@/lib/enterprise-creator-intelligence";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type DiscoveryEciInvestmentOverlay = {
  eci_investment_score: number | null;
  eci_investment_recommendation: string | null;
};

function clampScore(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function toInfluencerId(creator: UnifiedCreatorResult): string | null {
  const id = creator.influencer_id?.trim();
  if (!id) return null;
  if (id.startsWith("dp:") || id.startsWith("dis:")) return null;
  if (id.startsWith("inf:")) return id.slice(4) || null;
  return id;
}

function overlayFromBundle(bundle: CreatorIntelligenceBundle): DiscoveryEciInvestmentOverlay {
  return {
    eci_investment_score: clampScore(bundle.investment.overallScore),
    eci_investment_recommendation: bundle.investment.recommendation.recommendation ?? null,
  };
}

/**
 * Stamp ECI investment overlays onto UnifiedCreatorResult rows (browse-only fields).
 * Discovery-only profiles without influencer_id are left unchanged (score null).
 */
export async function enrichCreatorsWithEciInvestment(
  supabase: SupabaseClient,
  creators: UnifiedCreatorResult[],
  options?: { concurrency?: number; platform?: string | null }
): Promise<UnifiedCreatorResult[]> {
  if (creators.length === 0) return creators;

  const influencerIds = [
    ...new Set(
      creators
        .map(toInfluencerId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (influencerIds.length === 0) {
    return creators.map((c) => ({
      ...c,
      eci_investment_score: c.eci_investment_score ?? null,
      eci_investment_recommendation: c.eci_investment_recommendation ?? null,
    }));
  }

  const cache = createEciFactsCache();
  const { bundles } = await loadCreatorIntelligenceBundles(supabase, {
    influencerIds,
    platform: options?.platform ?? null,
    concurrency: options?.concurrency ?? 6,
    cache,
  });

  const byId = new Map(
    bundles.map((b) => [b.influencerId, overlayFromBundle(b)] as const)
  );

  return creators.map((creator) => {
    const id = toInfluencerId(creator);
    const overlay = id ? byId.get(id) : undefined;
    return {
      ...creator,
      eci_investment_score: overlay?.eci_investment_score ?? null,
      eci_investment_recommendation: overlay?.eci_investment_recommendation ?? null,
    };
  });
}

/** Display SSOT for Card/Detail/Compare — ECI investment only (never Thinkway / brand_fit). */
export function discoveryInvestmentScore(
  creator: Pick<
    UnifiedCreatorResult,
    "eci_investment_score" | "thinkway_score" | "brand_fit_score"
  >
): number | null {
  if (creator.eci_investment_score != null && Number.isFinite(creator.eci_investment_score)) {
    return Math.min(100, Math.max(0, Math.round(creator.eci_investment_score)));
  }
  return null;
}

export function formatDiscoveryInvestmentStar(
  score: number | null | undefined
): string {
  if (score == null || !Number.isFinite(score)) return "—";
  return (Math.max(0, Math.min(100, score)) / 10).toFixed(1);
}
