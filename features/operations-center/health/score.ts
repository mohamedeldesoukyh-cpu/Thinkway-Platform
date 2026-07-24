import type { ComponentStatus, WeightedComponent } from "../types";

/**
 * Weighted average of component scores → 0–100 overallHealthScore.
 * Offline/critical components pull the score down hard via their own scores.
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

export function statusFromScore(score: number): ComponentStatus {
  if (score >= 85) return "healthy";
  if (score >= 65) return "warning";
  if (score >= 35) return "critical";
  if (score <= 0) return "offline";
  return "critical";
}
