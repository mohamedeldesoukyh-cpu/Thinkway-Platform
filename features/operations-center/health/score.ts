import type {
  ComponentStatus,
  ScoreContribution,
  WeightedComponent,
} from "../types";

/**
 * Weighted average of component scores → 0–100 overallHealthScore.
 * Offline/critical components pull the score down hard via their own scores.
 *
 * Formula:
 *   overall = round( Σ (score_i × weight_i) / Σ weight_i )
 * Status→score map: healthy/expected=100, warning=70, critical=35, unknown=50, offline=0
 */
export function calculateOverallHealthScore(
  components: WeightedComponent[],
): number {
  if (components.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const component of components) {
    const weight = Math.max(0, component.weight);
    totalWeight += weight;
    weightedSum += component.score * weight;
  }
  if (totalWeight <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)));
}

export function buildScoreBreakdown(
  components: WeightedComponent[],
): { breakdown: ScoreContribution[]; totalWeight: number; overall: number } {
  const totalWeight = components.reduce(
    (sum, c) => sum + Math.max(0, c.weight),
    0,
  );
  const overall = calculateOverallHealthScore(components);
  const breakdown = components.map((component) => {
    const weight = Math.max(0, component.weight);
    const weightedPoints = component.score * weight;
    // Points toward the weighted total: (score/100) × weight
    // e.g. healthy(100) × weight 10 → +10; warning(70) × 10 → +7
    const contribution = Math.round((component.score / 100) * weight * 10) / 10;
    return {
      id: component.id,
      name: component.name ?? component.id,
      weight,
      status: component.status,
      score: component.score,
      weightedPoints,
      contribution,
    };
  });
  return { breakdown, totalWeight, overall };
}

export function statusFromScore(score: number): ComponentStatus {
  if (score >= 85) return "healthy";
  if (score >= 65) return "warning";
  if (score >= 35) return "critical";
  if (score <= 0) return "offline";
  return "critical";
}
