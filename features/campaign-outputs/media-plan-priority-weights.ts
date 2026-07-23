/**
 * Media plan creator-priority weight profiles — admin-tunable constants.
 *
 * How to tune (today):
 * - Edit `DEFAULT_MEDIA_PLAN_PRIORITY_WEIGHTS` below for global defaults.
 * - Per-campaign overrides: set `campaignObject.meta.mediaPlanSchedule.priorityWeights`
 *   with partial objective or phase vectors (merged onto defaults).
 *
 * Future: expose these vectors in Admin → Scheduling settings without code changes.
 *
 * Weight model:
 * - `objectives` — how the four factor groups combine per campaign goal.
 * - `phases` — multipliers applied when assigning creators to a journey phase
 *   (Launch, Amplification, Momentum, Wrap-up).
 *
 * Market opportunity (additive, separate from creator priority):
 * - `MARKET_OPPORTUNITY_DAY_INFLUENCE` — max ~18pt day-placement nudge (see market-intelligence-engine).
 * - `MARKET_OPPORTUNITY_WEEK_INFLUENCE` — max ~22pt week-allocation nudge.
 * - Never overrides pinned assignments, creator spacing, or journey phase rules.
 * - Per-campaign toggles: `campaignObject.meta.mediaPlanSchedule.marketIntelligence`.
 */

/** Max day-placement nudge from market score (points subtracted from penalty — lower = better). */
export const MARKET_OPPORTUNITY_DAY_INFLUENCE = 18;

/** Max week-allocation bonus from market score (added to week emphasis). */
export const MARKET_OPPORTUNITY_WEEK_INFLUENCE = 22;

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { CampaignMoment } from "./media-plan-moments";

/** Campaign goals parsed from facts.objective / brief signals. */
export type CampaignObjectiveKind =
  | "awareness"
  | "engagement"
  | "conversion"
  | "brand_recall"
  | "product_education";

/** Factor groups scored in `computeCreatorPriorityScore`. */
export type CreatorPriorityFactorKey = "performance" | "audience" | "creatorQuality" | "campaignFit";

/** Relative importance of each factor group for one objective (should sum ~1). */
export type ObjectiveFactorWeights = Record<CreatorPriorityFactorKey, number>;

/** Per-phase emphasis on factor groups — values are multipliers (1 = neutral). */
export type PhaseFactorMultipliers = Partial<Record<CreatorPriorityFactorKey, number>>;

export type MediaPlanPriorityWeights = {
  objectives: Record<CampaignObjectiveKind, ObjectiveFactorWeights>;
  phases: Record<CampaignMoment, PhaseFactorMultipliers>;
};

export type ResolvedPriorityWeights = {
  objective: CampaignObjectiveKind;
  factors: ObjectiveFactorWeights;
  phaseMultipliers: PhaseFactorMultipliers;
};

const BALANCED_OBJECTIVE: ObjectiveFactorWeights = {
  performance: 0.3,
  audience: 0.2,
  creatorQuality: 0.25,
  campaignFit: 0.25,
};

/** Default profiles — adjust here for platform-wide scheduling behaviour. */
export const DEFAULT_MEDIA_PLAN_PRIORITY_WEIGHTS: MediaPlanPriorityWeights = {
  objectives: {
    awareness: { performance: 0.45, audience: 0.25, creatorQuality: 0.15, campaignFit: 0.15 },
    engagement: { performance: 0.15, audience: 0.2, creatorQuality: 0.4, campaignFit: 0.25 },
    conversion: { performance: 0.2, audience: 0.25, creatorQuality: 0.35, campaignFit: 0.2 },
    brand_recall: { performance: 0.35, audience: 0.2, creatorQuality: 0.25, campaignFit: 0.2 },
    product_education: { performance: 0.2, audience: 0.15, creatorQuality: 0.35, campaignFit: 0.3 },
  },
  phases: {
    launch: { performance: 1.45, audience: 1.15, creatorQuality: 0.85, campaignFit: 0.9 },
    amplification: { performance: 1.1, audience: 1.2, creatorQuality: 1.25, campaignFit: 1.05 },
    momentum: { performance: 0.85, audience: 1.05, creatorQuality: 1.3, campaignFit: 1.1 },
    community: { performance: 0.75, audience: 1.1, creatorQuality: 1.35, campaignFit: 1.05 },
    ugc: { performance: 0.6, audience: 1.15, creatorQuality: 1.4, campaignFit: 1.2 },
    wrap_up: { performance: 0.7, audience: 1.25, creatorQuality: 1.25, campaignFit: 1.1 },
  },
};

function normalizeFactorWeights(weights: ObjectiveFactorWeights): ObjectiveFactorWeights {
  const sum =
    weights.performance + weights.audience + weights.creatorQuality + weights.campaignFit;
  if (sum <= 0) return { ...BALANCED_OBJECTIVE };
  return {
    performance: weights.performance / sum,
    audience: weights.audience / sum,
    creatorQuality: weights.creatorQuality / sum,
    campaignFit: weights.campaignFit / sum,
  };
}

/** Parse free-text campaign objective into a scheduling goal kind. */
export function parseCampaignObjectiveKind(text?: string): CampaignObjectiveKind {
  const lower = (text ?? "").toLowerCase();
  if (/\bengagement|ugc|community|participat|conversation|interact/.test(lower)) {
    return "engagement";
  }
  if (/\bconversion|purchase|sales|roi|convert|checkout|buy\b/.test(lower)) {
    return "conversion";
  }
  if (/\bbrand[\s-]?recall|recall|memorab|top[\s-]?of[\s-]?mind/.test(lower)) {
    return "brand_recall";
  }
  if (/\beducat|tutorial|how[\s-]?to|product[\s-]?learn|explain|demo/.test(lower)) {
    return "product_education";
  }
  return "awareness";
}

function mergeObjectiveWeights(
  base: ObjectiveFactorWeights,
  override?: Partial<ObjectiveFactorWeights>
): ObjectiveFactorWeights {
  if (!override) return normalizeFactorWeights(base);
  return normalizeFactorWeights({ ...base, ...override });
}

function mergePhaseMultipliers(
  base: PhaseFactorMultipliers,
  override?: PhaseFactorMultipliers
): PhaseFactorMultipliers {
  if (!override) return { ...base };
  return { ...base, ...override };
}

/** Resolve objective + optional meta overrides into factor weights for one phase. */
export function resolvePriorityWeights(input: {
  campaignObjective?: string;
  phase?: CampaignMoment;
  metaOverrides?: Partial<MediaPlanPriorityWeights>;
}): ResolvedPriorityWeights {
  const defaults = DEFAULT_MEDIA_PLAN_PRIORITY_WEIGHTS;
  const objective = parseCampaignObjectiveKind(input.campaignObjective);
  const objectiveOverrides = input.metaOverrides?.objectives?.[objective];
  const factors = mergeObjectiveWeights(defaults.objectives[objective], objectiveOverrides);

  const phase = input.phase ?? "launch";
  const phaseBase = defaults.phases[phase] ?? {};
  const phaseOverride = input.metaOverrides?.phases?.[phase];
  const phaseMultipliers = mergePhaseMultipliers(phaseBase, phaseOverride);

  return { objective, factors, phaseMultipliers };
}

/** Read per-campaign priority overrides from Campaign Object meta. */
export function priorityWeightsFromCampaignObject(
  campaignObject: CampaignObject
): Partial<MediaPlanPriorityWeights> | undefined {
  return campaignObject.meta.mediaPlanSchedule?.priorityWeights;
}

/** Convenience: resolve weights directly from a Campaign Object + phase. */
export function resolvePriorityWeightsFromCampaign(
  campaignObject: CampaignObject,
  phase?: CampaignMoment
): ResolvedPriorityWeights {
  const facts = campaignObject.meta.campaignFacts;
  return resolvePriorityWeights({
    campaignObjective: facts?.objective,
    phase,
    metaOverrides: priorityWeightsFromCampaignObject(campaignObject),
  });
}
