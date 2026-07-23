import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";
import { computeSnapshotCompleteness } from "@/lib/creator-enrichment/decision/snapshot/snapshot-completeness";

import {
  isMetricsFreshForPolicy,
  isWithinPolicyDays,
  resolveEnrichmentPolicy,
  type ResolvedEnrichmentPolicy,
} from "../policy/policy-engine";
import { calculateIntelligenceHealthScore } from "./health-score";
import type {
  CreatorRecommendationReport,
  RefreshRecommendation,
  RefreshRecommendationAction,
} from "./recommendation-types";

function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  return Math.floor((now - ts) / (24 * 60 * 60 * 1000));
}

function buildRecommendation(
  action: RefreshRecommendationAction,
  label: string,
  priority: number,
  reasons: string[],
  estimatedApifyCredits = 0,
  estimatedAiUnits = 0
): RefreshRecommendation {
  return Object.freeze({
    action,
    label,
    priority,
    reasons: Object.freeze([...reasons]),
    estimatedApifyCredits,
    estimatedAiUnits,
  });
}

function iplExpiresWithinDays(
  lastIPLFetch: string | null,
  validityDays: number,
  withinDays: number,
  now = Date.now()
): boolean {
  if (!lastIPLFetch) return false;
  const ts = Date.parse(lastIPLFetch);
  if (Number.isNaN(ts)) return false;
  const expiresAt = ts + validityDays * 24 * 60 * 60 * 1000;
  const threshold = now + withinDays * 24 * 60 * 60 * 1000;
  return expiresAt <= threshold && expiresAt > now;
}

/** Pure recommendation engine — recommendations only, no execution. */
export function generateRefreshRecommendations(input: {
  snapshot: CreatorIntelligenceSnapshot;
  policy?: ResolvedEnrichmentPolicy;
  now?: number;
}): CreatorRecommendationReport {
  const now = input.now ?? Date.now();
  const creatorId = input.snapshot.creatorId ?? input.snapshot.influencerId;
  if (!creatorId) {
    throw new Error("Cannot generate recommendations without creatorId.");
  }

  const policy =
    input.policy ??
    resolveEnrichmentPolicy({
      resolutionContext: Object.freeze({
        feature: "manual_refresh",
        force: false,
        requestedBy: null,
        platform:
          typeof input.snapshot.metadata.platform === "string"
            ? (input.snapshot.metadata.platform as never)
            : null,
        tier:
          input.snapshot.metadata.creatorTier === "vip" ||
          input.snapshot.metadata.creatorTier === "priority" ||
          input.snapshot.metadata.creatorTier === "standard"
            ? input.snapshot.metadata.creatorTier
            : null,
        campaignId:
          typeof input.snapshot.metadata.campaignId === "string"
            ? input.snapshot.metadata.campaignId
            : null,
      }),
    });

  const health = calculateIntelligenceHealthScore({
    snapshot: input.snapshot,
    policy,
  });

  const recommendations: RefreshRecommendation[] = [];
  const optimizationOpportunities: string[] = [];

  const metricsFresh = isMetricsFreshForPolicy(
    input.snapshot.lastSuccessfulEnrichment,
    policy.freshnessWindowDays,
    now
  );
  if (!metricsFresh) {
    const staleDays = daysSince(input.snapshot.lastSuccessfulEnrichment, now);
    recommendations.push(
      buildRecommendation(
        "refresh_metrics",
        "Refresh Metrics",
        90,
        [
          staleDays === null
            ? "Metrics never enriched"
            : `Metrics stale for ${staleDays} days`,
        ],
        0,
        0
      )
    );
  }

  if (!input.snapshot.hasIPLSnapshot) {
    recommendations.push(
      buildRecommendation(
        "refresh_ipl",
        "Refresh IPL",
        85,
        ["IPL snapshot missing"],
        1,
        0
      )
    );
  } else if (
    !isWithinPolicyDays(input.snapshot.lastIPLFetch, policy.iplValidityDays, now)
  ) {
    recommendations.push(
      buildRecommendation(
        "refresh_ipl",
        "Refresh IPL",
        80,
        ["IPL snapshot expired"],
        1,
        0
      )
    );
  } else if (
    iplExpiresWithinDays(input.snapshot.lastIPLFetch, policy.iplValidityDays, 1, now)
  ) {
    recommendations.push(
      buildRecommendation(
        "refresh_ipl",
        "Refresh IPL",
        70,
        ["Snapshot expires within 24 hours"],
        1,
        0
      )
    );
    optimizationOpportunities.push("ipl_expiring_soon");
  }

  const dnaCompleteness = input.snapshot.dnaCompleteness ?? 0;
  if (
    !input.snapshot.hasCreatorDNA ||
    dnaCompleteness < policy.dnaCompletenessThreshold
  ) {
    recommendations.push(
      buildRecommendation(
        "refresh_dna",
        "Refresh DNA",
        75,
        [
          !input.snapshot.hasCreatorDNA
            ? "Creator DNA missing"
            : `DNA completeness ${dnaCompleteness}% (threshold ${policy.dnaCompletenessThreshold}%)`,
        ],
        0,
        0.1
      )
    );
  }

  if (input.snapshot.audienceKnown !== true) {
    recommendations.push(
      buildRecommendation(
        "refresh_audience",
        "Refresh Audience",
        65,
        ["Audience intelligence missing or incomplete"],
        0,
        0
      )
    );
  } else if (
    !isWithinPolicyDays(
      input.snapshot.lastSuccessfulEnrichment,
      policy.audienceValidityDays,
      now
    )
  ) {
    recommendations.push(
      buildRecommendation(
        "refresh_audience",
        "Refresh Audience",
        60,
        ["Audience data aging"],
        0,
        0
      )
    );
  }

  if (
    input.snapshot.avatarFreshness !== "fresh" &&
    !(
      isWithinPolicyDays(
        input.snapshot.lastSuccessfulEnrichment,
        policy.avatarValidityDays,
        now
      ) && input.snapshot.hasIPLSnapshot
    )
  ) {
    recommendations.push(
      buildRecommendation(
        "refresh_avatar",
        "Refresh Avatar",
        55,
        ["Avatar refresh recommended"],
        0,
        0
      )
    );
  }

  if (input.snapshot.metadata.aiAnalysisComplete === false) {
    recommendations.push(
      buildRecommendation(
        "refresh_ai_analysis",
        "Refresh AI Analysis",
        40,
        ["AI analysis missing"],
        0,
        0.2
      )
    );
  }

  const completeness = computeSnapshotCompleteness(input.snapshot);
  if (completeness.snapshotCompleteness < 70) {
    recommendations.push(
      buildRecommendation(
        "complete_profile",
        "Complete Profile",
        50,
        [`Profile completeness ${completeness.snapshotCompleteness}%`],
        0,
        0
      )
    );
  }

  if (metricsFresh && input.snapshot.hasIPLSnapshot) {
    optimizationOpportunities.push("reuse_existing_ipl");
  }
  if (dnaCompleteness >= policy.dnaCompletenessThreshold) {
    optimizationOpportunities.push("reuse_existing_dna");
  }

  recommendations.sort((a, b) => b.priority - a.priority);

  return Object.freeze({
    creatorId,
    healthScore: health.overallScore,
    healthGrade: health.grade,
    recommendations: Object.freeze(recommendations),
    optimizationOpportunities: Object.freeze(optimizationOpportunities),
    generatedAt: new Date(now).toISOString(),
    policyVersion: policy.policyVersion,
    autonomous: true as const,
  });
}

export function generateRecommendationReportForSnapshot(
  snapshot: CreatorIntelligenceSnapshot
): CreatorRecommendationReport {
  return generateRefreshRecommendations({ snapshot });
}
