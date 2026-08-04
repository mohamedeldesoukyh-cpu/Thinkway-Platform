/**
 * Persisted manual refresh execution trace (support + soak evidence).
 * Stored on creator_enrichment_runs.execution_trace (jsonb).
 */

import type { RefreshFailureStage } from "./refresh-failure-stage";

export type ManualRefreshExecutionTrace = {
  refreshId: string;
  creatorId: string;
  budgetVerification: {
    allowed: boolean | null;
    code: string | null;
    reason: string | null;
  };
  actorId: string | null;
  externalRunId: string | null;
  datasetId: string | null;
  snapshotId: string | null;
  dnaUpdate: {
    attempted: boolean;
    ok: boolean | null;
    message: string | null;
  };
  eciUpdate: {
    attempted: boolean;
    ok: boolean | null;
    message: string | null;
  };
  finalStatus: string;
  failureStage: RefreshFailureStage | null;
  failureReason: string | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  platforms?: Array<{
    platform: string;
    ok: boolean;
    reason?: string | null;
    snapshotId?: string | null;
    externalRunId?: string | null;
  }>;
};

export function createEmptyManualRefreshTrace(input: {
  refreshId: string;
  creatorId: string;
  startedAt: string;
}): ManualRefreshExecutionTrace {
  return {
    refreshId: input.refreshId,
    creatorId: input.creatorId,
    budgetVerification: { allowed: null, code: null, reason: null },
    actorId: null,
    externalRunId: null,
    datasetId: null,
    snapshotId: null,
    dnaUpdate: { attempted: false, ok: null, message: null },
    eciUpdate: { attempted: false, ok: null, message: null },
    finalStatus: "running",
    failureStage: null,
    failureReason: null,
    durationMs: null,
    startedAt: input.startedAt,
    completedAt: null,
    platforms: [],
  };
}
