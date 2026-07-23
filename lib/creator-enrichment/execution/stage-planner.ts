import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

import type { ExecutionStageAction, ExecutionStageId } from "./execution-plan-types";
import { getOptimizationPolicy, isWithinDays } from "./optimization-policy";

export type StageDecision = Readonly<{
  stage: ExecutionStageId;
  action: ExecutionStageAction;
  reason: string;
}>;

function decideMetrics(force: boolean, snapshot: CreatorIntelligenceSnapshot): StageDecision {
  if (force) return { stage: "metrics", action: "run", reason: "force_refresh" };
  if (snapshot.metricsFreshness === "fresh") {
    return { stage: "metrics", action: "reuse", reason: "metrics_fresh" };
  }
  return { stage: "metrics", action: "run", reason: "metrics_stale_or_unknown" };
}

function decideIpl(force: boolean, snapshot: CreatorIntelligenceSnapshot): StageDecision {
  const policy = getOptimizationPolicy();
  if (force) return { stage: "ipl", action: "run", reason: "force_refresh" };
  if (
    snapshot.hasIPLSnapshot &&
    isWithinDays(snapshot.lastIPLFetch, policy.iplValidityDays)
  ) {
    return { stage: "ipl", action: "reuse", reason: "ipl_snapshot_valid" };
  }
  if (snapshot.hasIPLSnapshot) {
    return { stage: "ipl", action: "run", reason: "ipl_snapshot_expired" };
  }
  return { stage: "ipl", action: "run", reason: "ipl_snapshot_missing" };
}

function decideCreatorDna(force: boolean, snapshot: CreatorIntelligenceSnapshot): StageDecision {
  const policy = getOptimizationPolicy();
  if (force) return { stage: "creatorDna", action: "run", reason: "force_refresh" };
  const completeness = snapshot.dnaCompleteness ?? 0;
  const lifecycleOk =
    snapshot.dnaStatus === "complete" || snapshot.dnaStatus === "partial";
  if (
    snapshot.hasCreatorDNA &&
    lifecycleOk &&
    completeness >= policy.dnaCompletenessThreshold
  ) {
    return {
      stage: "creatorDna",
      action: "reuse",
      reason: "dna_complete_above_threshold",
    };
  }
  if (snapshot.hasCreatorDNA) {
    return { stage: "creatorDna", action: "run", reason: "dna_below_threshold" };
  }
  return { stage: "creatorDna", action: "run", reason: "dna_missing" };
}

function decideAvatar(force: boolean, snapshot: CreatorIntelligenceSnapshot): StageDecision {
  const policy = getOptimizationPolicy();
  if (force) return { stage: "avatar", action: "run", reason: "force_refresh" };
  if (snapshot.avatarFreshness === "fresh") {
    return { stage: "avatar", action: "reuse", reason: "avatar_fresh" };
  }
  if (
    isWithinDays(snapshot.lastSuccessfulEnrichment, policy.avatarValidityDays) &&
    snapshot.hasIPLSnapshot
  ) {
    return { stage: "avatar", action: "reuse", reason: "avatar_recent_enrichment" };
  }
  return { stage: "avatar", action: "run", reason: "avatar_refresh_needed" };
}

function decideAudience(force: boolean, snapshot: CreatorIntelligenceSnapshot): StageDecision {
  const policy = getOptimizationPolicy();
  if (force) return { stage: "audience", action: "run", reason: "force_refresh" };
  if (
    snapshot.audienceKnown === true &&
    isWithinDays(snapshot.lastSuccessfulEnrichment, policy.audienceValidityDays)
  ) {
    return { stage: "audience", action: "reuse", reason: "audience_intelligence_valid" };
  }
  if (snapshot.audienceKnown === true) {
    return { stage: "audience", action: "run", reason: "audience_data_stale" };
  }
  return { stage: "audience", action: "run", reason: "audience_intelligence_missing" };
}

function decidePlatformMetadata(
  force: boolean,
  snapshot: CreatorIntelligenceSnapshot
): StageDecision {
  if (force) {
    return { stage: "platformMetadata", action: "run", reason: "force_refresh" };
  }
  if (snapshot.metricsFreshness === "fresh" && snapshot.hasCreatorDNA) {
    return {
      stage: "platformMetadata",
      action: "reuse",
      reason: "platform_metadata_current",
    };
  }
  return {
    stage: "platformMetadata",
    action: "run",
    reason: "platform_metadata_refresh_needed",
  };
}

function decideAiAnalysis(force: boolean): StageDecision {
  if (force) {
    return { stage: "aiAnalysis", action: "skip", reason: "ai_not_in_enrichment_pipeline" };
  }
  return {
    stage: "aiAnalysis",
    action: "skip",
    reason: "ai_analysis_outside_commercial_pipeline",
  };
}

/** Pure stage decisions from snapshot intelligence — zero I/O. */
export function planStages(
  force: boolean,
  snapshot: CreatorIntelligenceSnapshot
): StageDecision[] {
  return [
    decideMetrics(force, snapshot),
    decideIpl(force, snapshot),
    decideCreatorDna(force, snapshot),
    decideAvatar(force, snapshot),
    decideAudience(force, snapshot),
    decidePlatformMetadata(force, snapshot),
    decideAiAnalysis(force),
  ];
}

export function planStagesForShortCircuit(
  decision: "skip" | "already_running",
  reason: string
): StageDecision[] {
  const stages: ExecutionStageId[] = [
    "metrics",
    "ipl",
    "creatorDna",
    "avatar",
    "audience",
    "platformMetadata",
    "aiAnalysis",
  ];
  return stages.map((stage) => ({
    stage,
    action: "skip" as const,
    reason: decision === "already_running" ? "enrichment_already_in_progress" : reason,
  }));
}
