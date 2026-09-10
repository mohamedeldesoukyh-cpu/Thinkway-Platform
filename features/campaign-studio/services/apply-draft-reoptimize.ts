import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  PerformanceSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  creatorTierStrategyToMix,
  getCampaignFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";

import { computeCampaignScores } from "./campaign-scores";
import { studioForecastArtifacts } from "./campaign-forecast-service";
import { studioDecisionArtifacts } from "./campaign-decision-service";
import { mapBrowseCreatorToSearchResult } from "./creator-platform-utils";
import { composeCreatorSlate, creatorTierOf } from "./creator-slate";
import { resolveCreatorTierMix } from "./creator-quantity";
import { deriveCreatorCategoriesFromBrief } from "./derive-creator-categories";
import {
  formatStudioEciReason,
  lookupStudioEciSignal,
  studioEciFitScoreRecord,
} from "./eci/project-studio-eci-signal";
import { loadStudioEciPlanningSignals } from "./eci/load-studio-eci-signals";
import { patchSlateIntelligence } from "./slate-intelligence";
import { normalizeCreatorId } from "./studio-draft";

/**
 * The tier mix re-optimization measures the edited slate against.
 *
 * The mix the slate was actually composed to wins. This path runs from a server
 * action with no workflow state, so it cannot reach the approved Strategy
 * document; re-deriving from Campaign Facts would score tier adherence against
 * a different target than the slate was built to, and an edit would then move
 * the health score for no visible reason. The persisted mix is that target —
 * no extra lookup and no new I/O.
 *
 * The Strategy → Facts order below is the pre-existing fallback, unchanged, for
 * a campaign whose slate predates the persisted composition.
 */
export function resolveReoptimizationTierMix(input: {
  composedMix?: Array<{ tier: string; percent: number }>;
  strategy?: CampaignStrategyDocument | null;
  facts?: CampaignFacts;
}): Array<{ tier: string; percent: number }> {
  if (input.composedMix && input.composedMix.length > 0) return input.composedMix;
  // Legacy slate with no persisted composition: resolve through the one SSOT so
  // the fallback target honours the brief's stated tiers, exactly like the
  // Strategy screen and the slate composer do.
  const strategyMix = input.strategy?.creatorTierStrategy?.length
    ? creatorTierStrategyToMix(input.strategy.creatorTierStrategy)
    : undefined;
  return resolveCreatorTierMix(input.facts ?? null, strategyMix);
}

/**
 * Drop slate-derived analysis that can no longer be recomputed.
 *
 * Every one of these is a function of the creator slate, written together by
 * this module, so they are cleared together — leaving a stale launch-readiness
 * decision beside a cleared forecast would be the same defect in a new place.
 * Everything else on the performance section (KPIs the operator confirmed,
 * success probability, benchmarks) is untouched.
 */
function withoutStaleCampaignAnalysis(campaignObject: CampaignObject): CampaignObject {
  const performanceData = (campaignObject.sections.performance?.data ??
    {}) as PerformanceSectionData;
  if (
    !performanceData.campaignForecast &&
    !performanceData.campaignScores &&
    !performanceData.campaignOptimization &&
    !performanceData.campaignDecision
  ) {
    return campaignObject;
  }

  const next = { ...performanceData };
  delete next.campaignForecast;
  delete next.campaignScores;
  delete next.campaignOptimization;
  delete next.campaignDecision;

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      performance: {
        ...campaignObject.sections.performance,
        data: next as unknown as Record<string, unknown>,
      },
    },
  };
}

/**
 * Post-apply re-optimization: re-rank the applied slate with the strategy
 * tier mix, refresh creator roles, and recompute the campaign scores from
 * the real creator data. Hand-picked creators are protected — re-ranking
 * reorders the slate but never drops a creator the team chose.
 */
export async function reoptimizeCampaignAfterApply(
  supabase: SupabaseClient,
  campaignObject: CampaignObject,
  options: { unenrichedCreatorIds?: string[] } = {}
): Promise<CampaignObject> {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const recommendations = creatorsData.recommendations;
  const slateIds = recommendations?.creatorIds ?? [];
  if (slateIds.length === 0) return campaignObject;

  const facts = getCampaignFacts(campaignObject);

  // Hydrate production creators; dp:/dis: entries stay in place untouched.
  const influencerIds = [
    ...new Set(
      slateIds
        .map((id) => id.trim())
        .filter((id) => Boolean(id) && !id.startsWith("dp:") && !id.startsWith("dis:"))
        .map(normalizeCreatorId)
    ),
  ];
  // A Discovery-only slate (every id dp:/dis:) has nothing to hydrate, so it
  // cannot be re-ranked. It must still not keep analysis describing the
  // creator set the operator just changed: the stale artifacts are dropped.
  //
  // They are dropped rather than recomputed from an empty card set, because
  // the engines return audienceSize 0 / estimatedReach 0 for no cards — a
  // false zero is worse than no figure. Absent is how this codebase already
  // represents "not computable" (cost metrics without a budget,
  // averageEngagementRate without ER data), and the panel renders nothing
  // when both artifacts are missing.
  if (influencerIds.length === 0) return withoutStaleCampaignAnalysis(campaignObject);

  let cards;
  try {
    const result = await browseUnifiedCreators(
      supabase,
      { influencerIds, page: 1, pageSize: influencerIds.length, productionOnly: true },
      "discovery"
    );
    cards = result.creators.map((creator) =>
      mapBrowseCreatorToSearchResult(creator, facts?.platforms)
    );
  } catch {
    // Re-optimization is best-effort — an hydration failure must never lose the apply.
    return campaignObject;
  }
  if (cards.length === 0) return campaignObject;

  // Re-rank with the strategy mix; append anything compose dropped (e.g. a
  // hand-picked off-platform creator) so no chosen creator disappears.
  const tierMix = resolveReoptimizationTierMix({
    composedMix: creatorsData.slateComposition?.requestedMix,
    strategy: getStrategyFromWorkflowData(
      campaignObject.meta as unknown as Record<string, unknown>
    ),
    facts,
  });
  const { creators: ranked } = composeCreatorSlate(cards, {
    platforms: facts?.platforms,
    tierMix,
    targetCount: cards.length,
    preferredCategories: deriveCreatorCategoriesFromBrief({
      briefText: facts?.rawBriefExcerpt,
      objective: facts?.objective,
      audience: facts?.audience,
      campaignName: facts?.product,
      products: facts?.product ? [facts.product] : undefined,
    }),
  });
  const rankedIds = new Set(ranked.map((c) => normalizeCreatorId(c.id)));
  const finalCards = [
    ...ranked,
    ...cards.filter((c) => !rankedIds.has(normalizeCreatorId(c.id))),
  ];

  // Preserve original id spelling (inf:-prefixed or raw) per creator.
  const originalIdByNormalized = new Map(slateIds.map((id) => [normalizeCreatorId(id), id]));
  const orderedIds = finalCards.map(
    (card) => originalIdByNormalized.get(normalizeCreatorId(card.id)) ?? card.id
  );
  const unhydratedIds = slateIds.filter(
    (id) =>
      id.startsWith("dp:") ||
      id.startsWith("dis:") ||
      !finalCards.some((card) => normalizeCreatorId(card.id) === normalizeCreatorId(id))
  );

  // Roles follow the refreshed follower data; reasoning text is preserved.
  const reasoningByNormalized = new Map(
    (recommendations?.selectedReasoning ?? []).map((entry) => [
      normalizeCreatorId(entry.creatorId),
      entry,
    ])
  );
  const nextReasoning: VendorSelectedReasoning[] = [];
  for (const card of finalCards) {
    const existing = reasoningByNormalized.get(normalizeCreatorId(card.id));
    if (!existing) continue;
    nextReasoning.push({ ...existing, expectedRole: creatorTierOf(card) });
  }
  for (const id of unhydratedIds) {
    const existing = reasoningByNormalized.get(normalizeCreatorId(id));
    if (existing) nextReasoning.push(existing);
  }

  const eciSignals = await loadStudioEciPlanningSignals(supabase, influencerIds, {
    platform: facts?.platforms?.[0] ?? null,
  }).catch(() => new Map());
  const eciFitScores = studioEciFitScoreRecord(eciSignals);
  const fitScores =
    Object.keys(eciFitScores).length > 0
      ? eciFitScores
      : recommendations?.creatorFitScores;
  const fitValues = Object.values(fitScores ?? {});
  const avgFitScore =
    fitValues.length > 0
      ? Math.round(fitValues.reduce((a, b) => a + b, 0) / fitValues.length)
      : recommendations?.avgFitScore;

  const nextReasoningWithEci = nextReasoning.map((entry) => {
    const signal = lookupStudioEciSignal(eciSignals, entry.creatorId);
    if (!signal) return entry;
    return {
      ...entry,
      whySelected: formatStudioEciReason(signal),
      audienceMatch: signal.commercialJustification,
      risk: signal.risks[0] ?? entry.risk,
      alternative: signal.alternatives[0] ?? entry.alternative,
      confidence:
        signal.confidencePercent != null
          ? Math.min(1, signal.confidencePercent / 100)
          : entry.confidence,
      evidence: signal.evidence.slice(0, 3).join(" · ") || entry.evidence,
    };
  });

  const scores = computeCampaignScores({
    cards: finalCards,
    facts,
    fitScores,
    tierMix,
    unenrichedCreatorIds: options.unenrichedCreatorIds,
  });

  const { snapshot, groundedKpis } = studioForecastArtifacts({ cards: finalCards, facts });
  const { optimization, decision } = studioDecisionArtifacts({
    cards: finalCards,
    facts,
    tierMix,
    scores,
    unenrichedCreatorIds: options.unenrichedCreatorIds,
  });

  const performanceData = (campaignObject.sections.performance.data ??
    {}) as PerformanceSectionData;
  const nextPerformance: PerformanceSectionData = {
    ...performanceData,
    campaignScores: scores,
    campaignForecast: snapshot,
    campaignOptimization: optimization,
    campaignDecision: decision,
    groundedKpis,
    ...(performanceData.successProbability
      ? {
          successProbability: {
            ...performanceData.successProbability,
            score: scores.overall,
          },
        }
      : {}),
  };

  const withCreators: CampaignObject = {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: {
          ...creatorsData,
          recommendations: {
            ...(recommendations ?? { creatorIds: [] }),
            creatorIds: [...orderedIds, ...unhydratedIds],
            selectedReasoning: nextReasoningWithEci,
            creatorFitScores: fitScores,
            avgFitScore,
          },
        } satisfies CreatorsSectionData,
      },
      performance: {
        ...campaignObject.sections.performance,
        data: nextPerformance as Record<string, unknown>,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  return patchSlateIntelligence(withCreators, finalCards);
}
