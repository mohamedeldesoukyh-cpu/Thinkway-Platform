import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignScoreSet } from "@/features/campaign-intelligence/types/section-schemas";
import type { SearchCreatorCardItem } from "@/features/campaign-studio/services/creator-platform-utils";
import type { CampaignForecast } from "@/lib/campaign-forecast";
import type { CampaignOptimizationReport } from "@/lib/campaign-optimization";
import {
  evaluateCampaignDecision,
  type CampaignConfiguration,
  type CampaignDecisionReport,
} from "@/lib/campaign-decision";
import {
  buildKpiTargetsFromForecast,
  buildStudioCampaignConfiguration,
} from "@/lib/campaign-decision/adapters/configuration-adapter";

import { computeStudioCampaignForecast } from "./campaign-forecast-service";
import { studioOptimizationArtifacts } from "./campaign-optimization-service";

export function evaluateStudioCampaignDecision(input: {
  cards: SearchCreatorCardItem[];
  facts?: CampaignFacts;
  tierMix?: Array<{ tier: string; percent: number }>;
  scores?: CampaignScoreSet;
  unenrichedCreatorIds?: string[];
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
  configuration?: CampaignConfiguration;
}): CampaignDecisionReport {
  const configuration =
    input.configuration ??
    buildStudioCampaignConfiguration({
      facts: input.facts,
      scores: input.scores,
      unenrichedCreatorCount: input.unenrichedCreatorIds?.length ?? 0,
    });

  configuration.kpiTargets = {
    ...buildKpiTargetsFromForecast(input.forecast),
    ...configuration.kpiTargets,
  };

  return evaluateCampaignDecision({
    forecast: input.forecast,
    optimization: input.optimization,
    configuration,
  });
}

export function studioDecisionArtifacts(input: {
  cards: SearchCreatorCardItem[];
  facts?: CampaignFacts;
  tierMix?: Array<{ tier: string; percent: number }>;
  scores?: CampaignScoreSet;
  unenrichedCreatorIds?: string[];
}): {
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
  decision: CampaignDecisionReport;
} {
  const { forecast, optimization } = studioOptimizationArtifacts(input);
  const decision = evaluateStudioCampaignDecision({ ...input, forecast, optimization });
  return { forecast, optimization, decision };
}

/** Convenience when forecast/optimization already computed. */
export function evaluateStudioDecisionFromArtifacts(input: {
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
  facts?: CampaignFacts;
  scores?: CampaignScoreSet;
  unenrichedCreatorIds?: string[];
}): CampaignDecisionReport {
  return evaluateStudioCampaignDecision({
    cards: [],
    forecast: input.forecast,
    optimization: input.optimization,
    facts: input.facts,
    scores: input.scores,
    unenrichedCreatorIds: input.unenrichedCreatorIds,
  });
}

export { computeStudioCampaignForecast };
