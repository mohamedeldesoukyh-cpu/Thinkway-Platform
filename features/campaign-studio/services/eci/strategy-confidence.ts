/**
 * Strategy Confidence + campaign decision labels.
 * Shared by executive views and recommendation narrative (avoids circular imports).
 */

import type { StudioEciPlanningSignal } from "./project-studio-eci-signal";

export type CampaignDecisionLabel = "Recommended" | "Not Recommended";

export type StrategyConfidenceLevel = "Very High" | "High" | "Moderate" | "Low";

export type StrategyConfidence = {
  level: StrategyConfidenceLevel;
  why: string;
  evidenceSupports: string;
  assumptions: string;
  whatCouldReduce: string;
};

function isNegative(label: string): boolean {
  return /high risk|insufficient|not recommended|avoid|consider with caution/i.test(label);
}

function isSoftPositive(label: string): boolean {
  return /^consider$/i.test(label.trim());
}

export function toCampaignDecisionLabel(recommendation: string): CampaignDecisionLabel {
  if (isNegative(recommendation)) return "Not Recommended";
  if (isSoftPositive(recommendation)) {
    // "Consider" is still a cautious yes for this campaign — surface as Recommended with softer bullets.
    return "Recommended";
  }
  return "Recommended";
}

export function deriveStrategyConfidence(signal: StudioEciPlanningSignal): StrategyConfidence {
  const coverage = signal.evidenceCoveragePercent ?? 0;
  const conf = signal.confidencePercent ?? coverage;
  const blended = Math.round(coverage * 0.55 + conf * 0.45);

  let level: StrategyConfidenceLevel = "Low";
  if (blended >= 85) level = "Very High";
  else if (blended >= 70) level = "High";
  else if (blended >= 50) level = "Moderate";

  const decision = toCampaignDecisionLabel(signal.recommendation);
  return {
    level,
    why:
      level === "Very High" || level === "High"
        ? `Planning confidence is ${level.toLowerCase()} because Enterprise Creator Intelligence shows consistent commercial, audience, and performance signals for this campaign decision (${decision}).`
        : `Planning confidence is ${level.toLowerCase()} because key planning inputs are incomplete or mixed — treat the recommendation as directional until evidence improves.`,
    evidenceSupports:
      signal.evidence.slice(0, 2).join("; ") ||
      `Evidence coverage ${coverage || "—"}% across investment, commercial, and audience layers.`,
    assumptions:
      "Assumes current rate cards, audience quality, and historical delivery patterns remain stable for this campaign window.",
    whatCouldReduce:
      signal.risks[0] ||
      "Missing commercial history, audience instability, or delivery risk would reduce planning confidence.",
  };
}
