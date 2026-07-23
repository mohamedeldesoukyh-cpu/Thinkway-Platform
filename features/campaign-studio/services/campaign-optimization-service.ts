import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { SearchCreatorCardItem } from "@/features/campaign-studio/services/creator-platform-utils";
import { creatorTierOf } from "@/features/campaign-studio/services/creator-slate";
import type { CampaignForecast } from "@/lib/campaign-forecast";
import {
  optimizeCampaign,
  type CampaignOptimizationContext,
  type CampaignOptimizationReport,
} from "@/lib/campaign-optimization";

import { computeStudioCampaignForecast } from "./campaign-forecast-service";

export function buildStudioOptimizationContext(input: {
  cards: SearchCreatorCardItem[];
  facts?: CampaignFacts;
  tierMix?: Array<{ tier: string; percent: number }>;
}): CampaignOptimizationContext {
  const creatorTiers = Object.fromEntries(
    input.cards.map((card) => [card.id, creatorTierOf(card)])
  );

  return {
    budget: input.facts?.budget?.amount
      ? { amount: input.facts.budget.amount, currency: input.facts.budget.currency }
      : undefined,
    tierMix: input.tierMix,
    creatorTiers,
    campaignPlatform: input.facts?.platforms?.[0] ?? input.cards[0]?.platform ?? null,
    audienceTargets: {
      countryCodes: input.facts?.geography,
    },
  };
}

/** Optimize Campaign Studio slate from forecast engine output. */
export function optimizeStudioCampaign(input: {
  cards: SearchCreatorCardItem[];
  facts?: CampaignFacts;
  tierMix?: Array<{ tier: string; percent: number }>;
  forecast?: CampaignForecast;
}): CampaignOptimizationReport {
  const forecast =
    input.forecast ??
    computeStudioCampaignForecast({ cards: input.cards, facts: input.facts });

  return optimizeCampaign({
    forecast,
    context: buildStudioOptimizationContext(input),
  });
}

export function studioOptimizationArtifacts(input: {
  cards: SearchCreatorCardItem[];
  facts?: CampaignFacts;
  tierMix?: Array<{ tier: string; percent: number }>;
}): {
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
} {
  const forecast = computeStudioCampaignForecast({ cards: input.cards, facts: input.facts });
  return {
    forecast,
    optimization: optimizeStudioCampaign({ ...input, forecast }),
  };
}
