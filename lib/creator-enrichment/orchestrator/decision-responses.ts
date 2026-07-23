import type { CreatorEnrichmentDecisionResult } from "@/lib/creator-enrichment/decision/decision-result";
import type {
  CreatorEnrichmentResult,
  EnqueueResult,
} from "@/lib/creator-enrichment/types";
import type { RefreshCreatorMetricsResult } from "@/lib/services/creators/creator-enrichment-service-shared";

export function buildSkippedRefreshResult(input: {
  creatorId: string;
  decision: CreatorEnrichmentDecisionResult;
}): RefreshCreatorMetricsResult {
  return {
    ok: true,
    influencerId: input.creatorId,
    syncStatus: "completed",
    queued: false,
    skipped: true,
    message: input.decision.reason,
  };
}

export function buildSkippedEnqueueResult(
  decision: CreatorEnrichmentDecisionResult
): EnqueueResult {
  return {
    queued: false,
    skipped: true,
    reason: decision.reason,
  };
}

export function buildSkippedExecuteResult(
  decision: CreatorEnrichmentDecisionResult
): CreatorEnrichmentResult {
  return {
    ok: true,
    status: "skipped",
    message: decision.reason,
    fieldsUpdated: [],
    skippedReason: decision.reason,
  };
}

export function buildAlreadyRunningRefreshResult(input: {
  creatorId: string;
  decision: CreatorEnrichmentDecisionResult;
}): RefreshCreatorMetricsResult {
  return {
    ok: true,
    influencerId: input.creatorId,
    syncStatus: "collecting",
    queued: false,
    skipped: true,
    message: input.decision.reason,
  };
}

export function buildAlreadyRunningEnqueueResult(
  decision: CreatorEnrichmentDecisionResult
): EnqueueResult {
  return {
    queued: false,
    skipped: true,
    reason: decision.reason,
  };
}

export function buildAlreadyRunningExecuteResult(
  decision: CreatorEnrichmentDecisionResult
): CreatorEnrichmentResult {
  return {
    ok: true,
    status: "skipped",
    message: decision.reason,
    fieldsUpdated: [],
    skippedReason: decision.reason,
  };
}

export function shouldDelegate(decision: CreatorEnrichmentDecisionResult): boolean {
  return decision.decision === "proceed";
}
