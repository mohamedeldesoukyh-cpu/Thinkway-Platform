import type { CampaignDecisionContext, ThinkwayScoreBreakdown } from "@/features/campaign-decision-engine";
import { THINKWAY_SCORE_WEIGHTS } from "@/features/campaign-decision-engine";

import type { ScoreMetricExplanation, ScoreMetricKey } from "../types";

const METRIC_LABELS: Record<ScoreMetricKey, string> = {
  budget: "Budget",
  creatorFit: "Creator Quality",
  audience: "Audience Match",
  risk: "Risk",
  timeline: "Timeline",
  kpis: "KPIs",
};

export function buildScoreExplanations(
  baseline: CampaignDecisionContext,
  score: ThinkwayScoreBreakdown,
  scenarioName: string
): ScoreMetricExplanation[] {
  const keys = Object.keys(THINKWAY_SCORE_WEIGHTS) as ScoreMetricKey[];

  return keys.map((key) => {
    const maxScore = THINKWAY_SCORE_WEIGHTS[key];
    const rawScore = score[key];
    return {
      key,
      label: METRIC_LABELS[key],
      score: rawScore,
      maxScore,
      why: buildWhy(key, baseline, rawScore, scenarioName),
      evidence: buildEvidence(key, baseline, rawScore),
      confidence: buildConfidence(key, rawScore),
      improvements: buildImprovements(key, rawScore),
    };
  });
}

function buildWhy(
  key: ScoreMetricKey,
  baseline: CampaignDecisionContext,
  rawScore: number,
  scenarioName: string
): string {
  switch (key) {
    case "budget":
      return rawScore >= 70
        ? `Budget allocation in "${scenarioName}" maintains efficient spend relative to projected reach for ${baseline.brand ?? "this brand"}.`
        : `Budget changes in "${scenarioName}" may reduce efficiency — reach per ${baseline.currency} is below baseline.`;
    case "creatorFit":
      return rawScore >= 72
        ? "Creator mix aligns with brand fit thresholds from DNA hydration and historical performance."
        : "One or more creators fall below the recommended fit score — review client-preferred alternatives.";
    case "audience":
      return rawScore >= 68
        ? "Projected audience overlap and engagement rate support campaign objectives."
        : "Audience match is weakened — reach or ER delta vs baseline suggests misalignment.";
    case "risk":
      return rawScore >= 70
        ? "Risk profile is within acceptable bounds for approval."
        : "Elevated risk factors detected — budget cuts, client creators, or timeline compression.";
    case "timeline":
      return rawScore >= 75
        ? "Timeline duration is optimal for content production and go-live."
        : "Timeline deviation from baseline increases delivery risk.";
    case "kpis":
      return rawScore >= 65
        ? "KPI projections (reach, conversions, ROAS) support campaign goals."
        : "KPI headroom is limited — consider budget or creator mix adjustments.";
    default:
      return "Score derived from simulation engine.";
  }
}

function buildEvidence(
  key: ScoreMetricKey,
  baseline: CampaignDecisionContext,
  rawScore: number
): string {
  switch (key) {
    case "budget":
      return `Baseline budget ${baseline.budget.total.toLocaleString()} ${baseline.budget.currency} · Score ${rawScore}/100`;
    case "creatorFit":
      return `${baseline.creators.length} creators · Avg fit from DNA hydration · Score ${rawScore}/100`;
    case "audience":
      return `Baseline reach ${baseline.kpis.reach.toLocaleString()} · ER ${baseline.kpis.engagementRate}% · Score ${rawScore}/100`;
    case "risk":
      return `${baseline.risk.highRiskCount} high-risk factor(s) · Risk score ${baseline.risk.score} · Component ${rawScore}/100`;
    case "timeline":
      return `${baseline.timeline.durationWeeks} weeks · Go-live week ${baseline.timeline.goLiveWeek} · Score ${rawScore}/100`;
    case "kpis":
      return `ROAS ${baseline.kpis.roas}x · CPM ${baseline.kpis.cpm} · Conversions ${baseline.kpis.conversions.toLocaleString()} · Score ${rawScore}/100`;
    default:
      return `Component score ${rawScore}/100`;
  }
}

function buildConfidence(key: ScoreMetricKey, rawScore: number): number {
  const base = key === "risk" ? 78 : 72;
  const variance = Math.abs(rawScore - 70) * 0.3;
  return Math.min(95, Math.round(base + variance));
}

function buildImprovements(key: ScoreMetricKey, rawScore: number): string[] {
  if (rawScore >= 80) {
    return ["Maintain current configuration", "Monitor mid-campaign KPI gates"];
  }

  const suggestions: Record<ScoreMetricKey, string[]> = {
    budget: ["Reallocate 5–10% from production to creator fees", "Consider phased budget release"],
    creatorFit: ["Replace lowest-fit creators with Thinkway recommendations", "Run client creator DNA evaluation"],
    audience: ["Expand to complementary creator tiers", "Adjust platform mix for ER uplift"],
    risk: ["Extend timeline by 1 week", "Reduce client creator count", "Add contingency buffer"],
    timeline: ["Align go-live with production milestones", "Avoid compressing below 4 weeks"],
    kpis: ["Increase post count on top performers", "Shift budget toward conversion-focused creators"],
  };

  return suggestions[key];
}
