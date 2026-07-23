import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorEnrichmentEnqueueOptions } from "@/lib/creator-enrichment/enrichment-feature";
import {
  buildDecisionContextFromEnqueueRequest,
  buildDecisionContextFromExecuteRequest,
  buildDecisionContextFromRefreshRequest,
  getCreatorEnrichmentDecisionEngine,
  type CreatorEnrichmentDecisionContext,
  type CreatorEnrichmentDecisionEngine,
  type CreatorEnrichmentDecisionOutcome,
} from "@/lib/creator-enrichment/decision";
import {
  attachActualDuration,
  buildExecutionPlan,
  logExecutionPlanComplete,
  logExecutionTrace,
  recordExecutionActualDuration,
  recordExecutionPlanMetrics,
  type ExecutionPlan,
} from "@/lib/creator-enrichment/execution";
import { buildGovernanceContextForRequest } from "@/lib/creator-enrichment/governance";
import { logManualRefreshTrace } from "@/lib/creator-enrichment/manual-refresh-trace";
import type {
  CreatorEnrichmentJobPayload,
  CreatorEnrichmentResult,
  EnqueueResult,
} from "@/lib/creator-enrichment/types";
import type {
  RefreshCreatorMetricsBatchResult,
  RefreshCreatorMetricsOptions,
  RefreshCreatorMetricsResult,
} from "@/lib/services/creators/creator-enrichment-service-shared";
import type { Database } from "@/types/database";

import { logEnrichmentAdmission, logOrchestratorEvent, type OrchestratorLogCore } from "./logging";
import {
  buildAlreadyRunningEnqueueResult,
  buildAlreadyRunningExecuteResult,
  buildAlreadyRunningRefreshResult,
  buildSkippedEnqueueResult,
  buildSkippedExecuteResult,
  buildSkippedRefreshResult,
  shouldDelegate,
} from "./decision-responses";
import {
  normalizeBatchRequest,
  normalizeEnqueueRequest,
  normalizeExecuteRequest,
  normalizeRefreshRequest,
} from "./request-normalizer";
import type {
  BatchRefreshDelegate,
  CreatorEnrichmentBatchResponse,
  CreatorEnrichmentEnqueueResponse,
  CreatorEnrichmentExecuteResponse,
  CreatorEnrichmentResponse,
  EnqueueDelegate,
  ExecuteJobDelegate,
  RefreshMetricsDelegate,
} from "./types";

type AnySupabase = SupabaseClient<Database>;

export type CreatorEnrichmentOrchestratorAdapters = {
  refreshCreatorMetrics: RefreshMetricsDelegate;
  enqueueCreatorEnrichment: EnqueueDelegate;
  executeCreatorMetricsRefresh: ExecuteJobDelegate;
  refreshCreatorMetricsBatchByUnifiedIds: BatchRefreshDelegate;
};

function requestCore(
  request: {
    requestId: string;
    feature: OrchestratorLogCore["feature"];
    trigger: OrchestratorLogCore["trigger"];
  },
  delegatedTo?: string,
  duration?: number
): OrchestratorLogCore {
  return {
    requestId: request.requestId,
    feature: request.feature,
    trigger: request.trigger,
    ...(delegatedTo ? { delegatedTo } : {}),
    ...(duration !== undefined ? { duration } : {}),
  };
}

/** Strip unified-id prefixes so Decision Engine snapshots key on influencer/profile ids. */
function creatorIdFromUnifiedId(unifiedId: string): string {
  const trimmed = unifiedId.trim();
  if (trimmed.startsWith("inf:") || trimmed.startsWith("dis:")) {
    return trimmed.slice(4);
  }
  return trimmed;
}

/**
 * Phase 1 orchestration layer — routes enrichment requests to existing
 * implementations without changing business logic, queue behavior, or outputs.
 */
export class CreatorEnrichmentOrchestrator {
  constructor(
    private readonly adapters: CreatorEnrichmentOrchestratorAdapters,
    private readonly decisionEngine: CreatorEnrichmentDecisionEngine = getCreatorEnrichmentDecisionEngine()
  ) {}

  /** Phase 2.3 — may skip fresh creators before delegation. */
  private async runDecision(context: CreatorEnrichmentDecisionContext) {
    return this.decisionEngine.decide(context);
  }

  /** Phase 3 — build advisory execution plan (zero I/O). */
  private buildAndLogExecutionPlan(
    context: CreatorEnrichmentDecisionContext,
    decision: CreatorEnrichmentDecisionOutcome
  ): ExecutionPlan {
    const plan = buildExecutionPlan({
      requestId: context.requestId,
      force: context.force,
      snapshot: decision.snapshot,
      decision,
    });
    logExecutionTrace(plan);
    recordExecutionPlanMetrics(plan);
    buildGovernanceContextForRequest({ context, decision, plan });
    return plan;
  }

  private logExecutionCompleted(plan: ExecutionPlan, actualDurationMs: number): void {
    const completedPlan = attachActualDuration(plan, actualDurationMs);
    recordExecutionActualDuration(completedPlan, actualDurationMs);
    logExecutionPlanComplete(completedPlan, actualDurationMs);
  }

  private logDecisionShortCircuit(
    request: { requestId: string; feature: OrchestratorLogCore["feature"]; trigger: OrchestratorLogCore["trigger"] },
    decision: Awaited<ReturnType<CreatorEnrichmentDecisionEngine["decide"]>>,
    extra?: Record<string, unknown>
  ): void {
    logOrchestratorEvent("completed", requestCore(request, decision.delegate, 0), {
      decision: decision.decision,
      reason: decision.reason,
      decidingRuleId: decision.decidingRuleId,
      skipped: decision.decision !== "proceed",
      ...extra,
    });
  }

  async requestRefresh(
    supabase: AnySupabase,
    creatorId: string,
    options: RefreshCreatorMetricsOptions = {}
  ): Promise<RefreshCreatorMetricsResult> {
    const request = normalizeRefreshRequest(supabase, creatorId, options);
    const delegatedTo = "refreshCreatorMetrics";

    logOrchestratorEvent(
      "request_received",
      requestCore(request),
      {
        creatorId: request.creatorId,
        platformAccountId: request.platformAccountId,
        force: request.force,
        scope: request.scope,
        priority: request.priority,
        requestedBy: request.requestedBy,
        timestamp: request.timestamp,
      }
    );

    const decisionContext = buildDecisionContextFromRefreshRequest(request, delegatedTo);
    const decision = await this.runDecision(decisionContext);
    const plan = this.buildAndLogExecutionPlan(decisionContext, decision);

    logEnrichmentAdmission({
      creatorId: request.creatorId,
      decision: decision.decision,
      reason: decision.reason,
      force: request.force,
      source: request.feature,
    });

    if (!shouldDelegate(decision)) {
      const result =
        decision.decision === "already_running"
          ? buildAlreadyRunningRefreshResult({ creatorId: request.creatorId, decision })
          : buildSkippedRefreshResult({ creatorId: request.creatorId, decision });
      this.logDecisionShortCircuit(request, decision, {
        creatorId: result.influencerId,
        syncStatus: result.syncStatus,
        queued: result.queued,
        ok: result.ok,
        skipped: result.skipped,
        planId: plan.planId,
        optimizationSummary: plan.optimizationSummary,
      });
      return result;
    }

    const startedAt = Date.now();

    try {
      logOrchestratorEvent("delegated", requestCore(request, delegatedTo), {
        creatorId: request.creatorId,
        planId: plan.planId,
        enforcementEnabled: plan.enforcementEnabled,
        estimatedDurationMs: plan.totals.estimatedDurationMs,
        optimizationPercentage: plan.totals.optimizationPercentage,
      });

      const result = await this.adapters.refreshCreatorMetrics(
        request.supabase,
        request.creatorId,
        request.options
      );

      const duration = Date.now() - startedAt;
      this.logExecutionCompleted(plan, duration);
      const response: CreatorEnrichmentResponse<RefreshCreatorMetricsResult> = {
        requestId: request.requestId,
        status: result.ok ? "completed" : "failed",
        delegatedTo,
        durationMs: duration,
        result,
      };

      logOrchestratorEvent(
        response.status === "completed" ? "completed" : "failed",
        requestCore(request, response.delegatedTo, duration),
        {
          creatorId: result.influencerId,
          syncStatus: result.syncStatus,
          queued: result.queued,
          ok: result.ok,
        }
      );

      return response.result;
    } catch (error) {
      const duration = Date.now() - startedAt;
      logOrchestratorEvent("failed", requestCore(request, delegatedTo, duration), {
        creatorId: request.creatorId,
        message: error instanceof Error ? error.message : "Enrichment failed.",
      });
      throw error;
    }
  }

  async enqueue(
    payload: CreatorEnrichmentJobPayload,
    options?: CreatorEnrichmentEnqueueOptions
  ): Promise<EnqueueResult> {
    const request = normalizeEnqueueRequest(payload, options);
    const delegatedTo = "enqueueCreatorEnrichment";

    logOrchestratorEvent(
      "request_received",
      requestCore(request),
      {
        creatorId: request.creatorId,
        platformAccountId: request.payload.platformAccountId,
        force: request.payload.force ?? false,
        scope: request.payload.scope ?? "all",
        priority: request.priority,
        requestedBy: request.requestedBy,
        timestamp: request.timestamp,
        isBulk: request.isBulk ?? false,
      }
    );

    const decisionContext = buildDecisionContextFromEnqueueRequest(request, delegatedTo);
    const decision = await this.runDecision(decisionContext);
    const plan = this.buildAndLogExecutionPlan(decisionContext, decision);

    if (!shouldDelegate(decision)) {
      const result =
        decision.decision === "already_running"
          ? buildAlreadyRunningEnqueueResult(decision)
          : buildSkippedEnqueueResult(decision);
      this.logDecisionShortCircuit(request, decision, {
        creatorId: request.creatorId,
        queued: result.queued,
        skipped: result.skipped,
        reason: result.reason,
        planId: plan.planId,
        optimizationSummary: plan.optimizationSummary,
      });
      return result;
    }

    const startedAt = Date.now();

    try {
      logOrchestratorEvent("delegated", requestCore(request, delegatedTo), {
        creatorId: request.creatorId,
        planId: plan.planId,
        enforcementEnabled: plan.enforcementEnabled,
        estimatedDurationMs: plan.totals.estimatedDurationMs,
        optimizationPercentage: plan.totals.optimizationPercentage,
      });

      const result = await this.adapters.enqueueCreatorEnrichment(
        request.payload,
        { isBulk: request.isBulk }
      );

      const duration = Date.now() - startedAt;
      this.logExecutionCompleted(plan, duration);
      const response: CreatorEnrichmentEnqueueResponse = {
        requestId: request.requestId,
        status: result.queued ? "completed" : "failed",
        delegatedTo,
        durationMs: duration,
        result,
      };

      logOrchestratorEvent(
        response.status === "completed" ? "completed" : "failed",
        requestCore(request, response.delegatedTo, duration),
        {
          creatorId: request.creatorId,
          queued: result.queued,
          jobId: result.jobId,
          reason: result.reason,
        }
      );

      return response.result;
    } catch (error) {
      const duration = Date.now() - startedAt;
      logOrchestratorEvent("failed", requestCore(request, delegatedTo, duration), {
        creatorId: request.creatorId,
        message: error instanceof Error ? error.message : "Enqueue failed.",
      });
      throw error;
    }
  }

  enqueueBestEffort(
    payload: CreatorEnrichmentJobPayload,
    options?: Pick<CreatorEnrichmentEnqueueOptions, "feature">
  ): void {
    void this.enqueue(payload, options).catch((error) => {
      console.error(
        "[creator-enrichment] enqueue failed (non-blocking)",
        error instanceof Error ? error.message : error
      );
    });
  }

  async executeJob(
    supabase: AnySupabase,
    payload: CreatorEnrichmentJobPayload,
    options?: { attempt?: number; jobId?: string | null }
  ): Promise<CreatorEnrichmentResult> {
    const request = normalizeExecuteRequest(supabase, payload, options);
    const delegatedTo = "executeCreatorMetricsRefresh";

    logOrchestratorEvent(
      "request_received",
      requestCore(request),
      {
        creatorId: request.creatorId,
        platformAccountId: request.payload.platformAccountId,
        force: request.payload.force ?? false,
        scope: request.payload.scope ?? "all",
        priority: request.priority,
        requestedBy: request.requestedBy,
        timestamp: request.timestamp,
        attempt: request.attempt,
        jobId: request.jobId,
      }
    );

    const decisionContext = buildDecisionContextFromExecuteRequest(request, delegatedTo);
    const decision = await this.runDecision(decisionContext);
    const plan = this.buildAndLogExecutionPlan(decisionContext, decision);

    if (!shouldDelegate(decision)) {
      const result =
        decision.decision === "already_running"
          ? buildAlreadyRunningExecuteResult(decision)
          : buildSkippedExecuteResult(decision);
      this.logDecisionShortCircuit(request, decision, {
        creatorId: request.creatorId,
        enrichmentStatus: result.status,
        ok: result.ok,
        skipped: true,
        planId: plan.planId,
        optimizationSummary: plan.optimizationSummary,
      });
      logManualRefreshTrace("freshness_decision", {
        influencerId: request.creatorId,
        stage: "decision_engine_execute",
        skip: true,
        decision: decision.decision,
        reason: decision.reason,
        decidingRuleId: decision.decidingRuleId,
        force: request.payload.force ?? false,
        apifyCalled: false,
        note: "Decision Engine short-circuit — runCreatorEnrichment not invoked",
      });
      return result;
    }

    const startedAt = Date.now();

    try {
      logOrchestratorEvent("delegated", requestCore(request, delegatedTo), {
        creatorId: request.creatorId,
        planId: plan.planId,
        enforcementEnabled: plan.enforcementEnabled,
        estimatedDurationMs: plan.totals.estimatedDurationMs,
        optimizationPercentage: plan.totals.optimizationPercentage,
      });

      const result = await this.adapters.executeCreatorMetricsRefresh(
        request.supabase,
        request.payload,
        { attempt: request.attempt, jobId: request.jobId }
      );

      const duration = Date.now() - startedAt;
      this.logExecutionCompleted(plan, duration);
      const response: CreatorEnrichmentExecuteResponse = {
        requestId: request.requestId,
        status: result.ok ? "completed" : "failed",
        delegatedTo,
        durationMs: duration,
        result,
      };

      logOrchestratorEvent(
        response.status === "completed" ? "completed" : "failed",
        requestCore(request, response.delegatedTo, duration),
        {
          creatorId: request.creatorId,
          enrichmentStatus: result.status,
          ok: result.ok,
        }
      );

      return response.result;
    } catch (error) {
      const duration = Date.now() - startedAt;
      logOrchestratorEvent("failed", requestCore(request, delegatedTo, duration), {
        creatorId: request.creatorId,
        message: error instanceof Error ? error.message : "Job execution failed.",
      });
      throw error;
    }
  }

  async requestBatchRefresh(
    supabase: AnySupabase,
    unifiedIds: string[],
    options: RefreshCreatorMetricsOptions = {}
  ): Promise<RefreshCreatorMetricsBatchResult> {
    const request = normalizeBatchRequest(supabase, unifiedIds, options);
    const delegatedTo = "refreshCreatorMetricsBatchByUnifiedIds";
    const force = request.options.force ?? false;
    const source = request.feature;

    logOrchestratorEvent(
      "request_received",
      requestCore(request),
      {
        creatorCount: request.unifiedIds.length,
        scope: request.scope,
        priority: request.priority,
        requestedBy: request.requestedBy,
        timestamp: request.timestamp,
        isBulk: request.options.isBulk ?? false,
        force,
      }
    );

    const admittedUnifiedIds: string[] = [];
    const skippedResults: RefreshCreatorMetricsResult[] = [];

    for (const unifiedId of request.unifiedIds) {
      const creatorId = creatorIdFromUnifiedId(unifiedId);
      const perCreatorRequest = normalizeRefreshRequest(request.supabase, creatorId, {
        ...request.options,
        force,
        isBulk: true,
        feature: request.feature,
      });
      const decisionContext = buildDecisionContextFromRefreshRequest(
        perCreatorRequest,
        delegatedTo
      );
      const decision = await this.runDecision(decisionContext);

      logEnrichmentAdmission({
        creatorId: perCreatorRequest.creatorId,
        decision: decision.decision,
        reason: decision.reason,
        force,
        source,
      });

      if (shouldDelegate(decision)) {
        admittedUnifiedIds.push(unifiedId);
        continue;
      }

      skippedResults.push(
        decision.decision === "already_running"
          ? buildAlreadyRunningRefreshResult({
              creatorId: perCreatorRequest.creatorId,
              decision,
            })
          : buildSkippedRefreshResult({
              creatorId: perCreatorRequest.creatorId,
              decision,
            })
      );
    }

    if (admittedUnifiedIds.length === 0) {
      const emptyResult: RefreshCreatorMetricsBatchResult = {
        ok: true,
        total: request.unifiedIds.length,
        queued: 0,
        failed: 0,
        results: skippedResults,
        message: "All creators skipped by Decision Engine.",
      };
      logOrchestratorEvent("completed", requestCore(request, delegatedTo, 0), {
        total: emptyResult.total,
        skipped: skippedResults.length,
        queued: 0,
        force,
        source,
        decision: "skip",
        reason: "batch_all_skipped",
      });
      return emptyResult;
    }

    const startedAt = Date.now();

    try {
      logOrchestratorEvent("delegated", requestCore(request, delegatedTo), {
        creatorCount: admittedUnifiedIds.length,
        skipped: skippedResults.length,
        force,
        source,
      });

      const result = await this.adapters.refreshCreatorMetricsBatchByUnifiedIds(
        request.supabase,
        admittedUnifiedIds,
        request.options
      );

      const merged: RefreshCreatorMetricsBatchResult = {
        ...result,
        total: request.unifiedIds.length,
        results: [...skippedResults, ...result.results],
        message:
          skippedResults.length > 0
            ? `${skippedResults.length} skipped by Decision Engine; ${result.queued} queued.`
            : result.message,
      };

      const duration = Date.now() - startedAt;
      const response: CreatorEnrichmentBatchResponse = {
        requestId: request.requestId,
        status: merged.ok ? "completed" : "failed",
        delegatedTo,
        durationMs: duration,
        result: merged,
      };

      logOrchestratorEvent(
        response.status === "completed" ? "completed" : "failed",
        requestCore(request, response.delegatedTo, duration),
        {
          total: merged.total,
          queued: merged.queued,
          failed: merged.failed,
          skipped: skippedResults.length,
          admitted: admittedUnifiedIds.length,
          acquisitionMode: merged.acquisitionMode,
          force,
          source,
        }
      );

      return response.result;
    } catch (error) {
      const duration = Date.now() - startedAt;
      logOrchestratorEvent("failed", requestCore(request, delegatedTo, duration), {
        creatorCount: request.unifiedIds.length,
        admitted: admittedUnifiedIds.length,
        message: error instanceof Error ? error.message : "Batch refresh failed.",
      });
      throw error;
    }
  }
}
