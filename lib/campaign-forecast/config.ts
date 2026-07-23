/**
 * Configurable intelligence parameters for the Campaign Forecast Engine.
 * All values are deterministic defaults — tunable without code changes via input.overlapConfig.
 */

export type DeliverableDecayFamily = "reel" | "story" | "post" | "video" | "default";

/** Diminishing returns per sequential deliverable unit (1st = index 0). */
export const DELIVERABLE_DECAY_CURVES: Record<DeliverableDecayFamily, readonly number[]> = {
  reel: [1.0, 0.8, 0.65, 0.55, 0.5],
  video: [1.0, 0.8, 0.65, 0.55, 0.5],
  story: [1.0, 0.7, 0.55, 0.45, 0.4],
  post: [1.0, 0.85, 0.72, 0.62, 0.55],
  default: [1.0, 0.75, 0.6, 0.5, 0.45],
};

/** Same creator publishing on multiple platforms — audience overlap factor. */
export const CROSS_PLATFORM_OVERLAP_RATE = 0.35;

/** Pairwise overlap signal weights (sum capped at 1). */
export const OVERLAP_SIGNAL_WEIGHTS = {
  sameCountry: 0.15,
  sharedLanguage: 0.1,
  samePlatform: 0.1,
  categoryOverlap: 0.15,
  sameNiche: 0.2,
  demographicOverlap: 0.1,
} as const;

/** Default pairwise overlap when intelligence signals are sparse. */
export const DEFAULT_PAIR_OVERLAP_RATE = 0.08;

/** Maximum pairwise overlap rate applied between two creators. */
export const MAX_PAIR_OVERLAP_RATE = 0.45;

/** Default campaign-level overlap when only creator count is known. */
export const DEFAULT_CAMPAIGN_OVERLAP_PER_CREATOR = 0.05;

export type CampaignForecastOverlapConfig = {
  defaultPairOverlapRate?: number;
  maxPairOverlapRate?: number;
  crossPlatformOverlapRate?: number;
  defaultCampaignOverlapPerCreator?: number;
};

export const DEFAULT_OVERLAP_CONFIG: Required<CampaignForecastOverlapConfig> = {
  defaultPairOverlapRate: DEFAULT_PAIR_OVERLAP_RATE,
  maxPairOverlapRate: MAX_PAIR_OVERLAP_RATE,
  crossPlatformOverlapRate: CROSS_PLATFORM_OVERLAP_RATE,
  defaultCampaignOverlapPerCreator: DEFAULT_CAMPAIGN_OVERLAP_PER_CREATOR,
};

/** Category reach adjustment vs platform benchmark (similar-creator proxy). */
export const CATEGORY_REACH_ADJUSTMENTS: Record<string, number> = {
  beauty: 1.05,
  fashion: 1.04,
  fitness: 1.03,
  food: 1.02,
  parenting: 1.06,
  finance: 0.92,
  tech: 0.95,
  gaming: 1.08,
};
