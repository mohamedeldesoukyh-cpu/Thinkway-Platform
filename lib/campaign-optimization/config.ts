/**
 * Campaign Optimization Engine — tunable thresholds and weights (Phase 4).
 */

export const CAMPAIGN_OPTIMIZATION_ENGINE_VERSION = "campaign_optimization_v1" as const;

/** Health score dimension weights (must sum to 100). */
export const HEALTH_SCORE_WEIGHTS = {
  forecastConfidence: 20,
  reachEfficiency: 20,
  budgetEfficiency: 15,
  audienceQuality: 15,
  creatorDiversity: 15,
  platformBalance: 15,
} as const;

/** Overlap deduction / gross reach above this triggers reach opportunity. */
export const HIGH_OVERLAP_RATIO_THRESHOLD = 0.18;

/** Single creator share of net reach above this = concentration risk. */
export const REACH_CONCENTRATION_THRESHOLD = 0.45;

/** Net reach / audience size below this = low reach efficiency. */
export const LOW_REACH_EFFICIENCY_THRESHOLD = 0.35;

/** Tier share above this for one tier = mix imbalance. */
export const TIER_IMBALANCE_THRESHOLD = 0.55;

/** Platform share above this = platform concentration. */
export const PLATFORM_CONCENTRATION_THRESHOLD = 0.7;

/** Deliverable type share above this = deliverable concentration. */
export const DELIVERABLE_CONCENTRATION_THRESHOLD = 0.75;

/** Cost-per-reach above benchmark multiplier triggers budget opportunity. */
export const HIGH_COST_PER_REACH_MULTIPLIER = 1.35;

export const IMPACT_PENALTY_POINTS: Record<"high" | "medium" | "low", number> = {
  high: 22,
  medium: 12,
  low: 6,
};

export const ER_BENCHMARKS: Record<string, number> = {
  tiktok: 5.5,
  instagram: 2.5,
  youtube: 3.5,
};

export function tierFromFollowers(followers: number): string {
  if (followers >= 1_000_000) return "Mega";
  if (followers >= 500_000) return "Macro";
  if (followers >= 100_000) return "Mid";
  if (followers >= 10_000) return "Micro";
  return "Nano";
}

export function resolvePlatformBenchmark(platform: string | null | undefined): number {
  const key = (platform ?? "").toLowerCase();
  const match = Object.entries(ER_BENCHMARKS).find(([name]) => key.includes(name));
  return match?.[1] ?? 3.5;
}
