import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

import {
  isWithinPolicyDays,
  type ResolvedEnrichmentPolicy,
} from "../policy/policy-engine";

export type HealthScoreComponent = Readonly<{
  id: "metrics" | "dna" | "audience" | "ipl" | "avatar" | "ai";
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  status: "healthy" | "warning" | "critical" | "unknown";
  detail: string;
}>;

export type IntelligenceHealthScore = Readonly<{
  creatorId: string | null;
  overallScore: number;
  grade: "excellent" | "good" | "fair" | "poor" | "critical";
  components: readonly HealthScoreComponent[];
  calculatedAt: string;
  policyVersion: string;
}>;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function gradeFromScore(score: number): IntelligenceHealthScore["grade"] {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

function statusFromScore(score: number): HealthScoreComponent["status"] {
  if (score >= 80) return "healthy";
  if (score >= 50) return "warning";
  if (score > 0) return "critical";
  return "unknown";
}

function scoreMetrics(snapshot: CreatorIntelligenceSnapshot): HealthScoreComponent {
  let score = 50;
  let detail = "Metrics freshness unknown";
  if (snapshot.metricsFreshness === "fresh") {
    score = 100;
    detail = "Metrics within freshness window";
  } else if (snapshot.metricsFreshness === "stale") {
    score = 25;
    detail = "Metrics stale";
  }
  return Object.freeze({
    id: "metrics",
    label: "Metrics freshness",
    score,
    weight: 0,
    weightedScore: 0,
    status: statusFromScore(score),
    detail,
  });
}

function scoreDna(
  snapshot: CreatorIntelligenceSnapshot,
  policy: ResolvedEnrichmentPolicy
): HealthScoreComponent {
  const completeness = snapshot.dnaCompleteness ?? 0;
  const threshold = policy.dnaCompletenessThreshold;
  let score = snapshot.hasCreatorDNA ? completeness : 0;
  let detail = snapshot.hasCreatorDNA
    ? `DNA completeness ${completeness}% (threshold ${threshold}%)`
    : "Creator DNA missing";
  if (snapshot.dnaStatus === "missing") {
    score = 0;
    detail = "Creator DNA missing";
  }
  return Object.freeze({
    id: "dna",
    label: "DNA completeness",
    score: clampScore(score),
    weight: 0,
    weightedScore: 0,
    status: statusFromScore(score),
    detail,
  });
}

function scoreAudience(snapshot: CreatorIntelligenceSnapshot): HealthScoreComponent {
  let score = 50;
  let detail = "Audience intelligence unknown";
  if (snapshot.audienceKnown === true) {
    score = 100;
    detail = "Audience intelligence present";
  } else if (snapshot.audienceKnown === false) {
    score = 30;
    detail = "Audience intelligence missing";
  }
  return Object.freeze({
    id: "audience",
    label: "Audience completeness",
    score,
    weight: 0,
    weightedScore: 0,
    status: statusFromScore(score),
    detail,
  });
}

function scoreIpl(
  snapshot: CreatorIntelligenceSnapshot,
  policy: ResolvedEnrichmentPolicy
): HealthScoreComponent {
  if (!snapshot.hasIPLSnapshot) {
    return Object.freeze({
      id: "ipl",
      label: "IPL freshness",
      score: 0,
      weight: 0,
      weightedScore: 0,
      status: "critical",
      detail: "IPL snapshot missing",
    });
  }
  const valid = isWithinPolicyDays(snapshot.lastIPLFetch, policy.iplValidityDays);
  return Object.freeze({
    id: "ipl",
    label: "IPL freshness",
    score: valid ? 100 : 35,
    weight: 0,
    weightedScore: 0,
    status: valid ? "healthy" : "warning",
    detail: valid ? "IPL snapshot valid" : "IPL snapshot expired",
  });
}

function scoreAvatar(
  snapshot: CreatorIntelligenceSnapshot,
  policy: ResolvedEnrichmentPolicy
): HealthScoreComponent {
  if (snapshot.avatarFreshness === "fresh") {
    return Object.freeze({
      id: "avatar",
      label: "Avatar freshness",
      score: 100,
      weight: 0,
      weightedScore: 0,
      status: "healthy",
      detail: "Avatar fresh",
    });
  }
  const recent =
    isWithinPolicyDays(snapshot.lastSuccessfulEnrichment, policy.avatarValidityDays) &&
    snapshot.hasIPLSnapshot;
  return Object.freeze({
    id: "avatar",
    label: "Avatar freshness",
    score: recent ? 80 : 40,
    weight: 0,
    weightedScore: 0,
    status: recent ? "healthy" : "warning",
    detail: recent ? "Avatar recently enriched" : "Avatar refresh recommended",
  });
}

function scoreAi(snapshot: CreatorIntelligenceSnapshot): HealthScoreComponent {
  const metadata = snapshot.metadata;
  const aiCoverage =
    typeof metadata.aiAnalysisComplete === "boolean"
      ? metadata.aiAnalysisComplete
      : null;
  let score = 50;
  let detail = "AI analysis coverage unknown";
  if (aiCoverage === true) {
    score = 100;
    detail = "AI analysis complete";
  } else if (aiCoverage === false) {
    score = 20;
    detail = "AI analysis missing";
  } else if (snapshot.hasCreatorDNA && (snapshot.dnaCompleteness ?? 0) >= 70) {
    score = 60;
    detail = "AI analysis not in pipeline — DNA used as proxy";
  }
  return Object.freeze({
    id: "ai",
    label: "AI coverage",
    score,
    weight: 0,
    weightedScore: 0,
    status: statusFromScore(score),
    detail,
  });
}

/** Pure health score — zero I/O. */
export function calculateIntelligenceHealthScore(input: {
  snapshot: CreatorIntelligenceSnapshot;
  policy: ResolvedEnrichmentPolicy;
}): IntelligenceHealthScore {
  const weights = input.policy.healthScoreWeights;
  const rawComponents = [
    scoreMetrics(input.snapshot),
    scoreDna(input.snapshot, input.policy),
    scoreAudience(input.snapshot),
    scoreIpl(input.snapshot, input.policy),
    scoreAvatar(input.snapshot, input.policy),
    scoreAi(input.snapshot),
  ];

  const components = rawComponents.map((component) => {
    const weight = weights[component.id];
    const weightedScore = component.score * weight;
    return Object.freeze({
      ...component,
      weight,
      weightedScore,
    });
  });

  const overallScore = clampScore(
    components.reduce((sum, component) => sum + component.weightedScore, 0)
  );

  return Object.freeze({
    creatorId: input.snapshot.creatorId,
    overallScore,
    grade: gradeFromScore(overallScore),
    components,
    calculatedAt: new Date().toISOString(),
    policyVersion: input.policy.policyVersion,
  });
}
