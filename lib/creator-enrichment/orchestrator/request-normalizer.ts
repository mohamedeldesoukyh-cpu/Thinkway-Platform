import { randomUUID } from "node:crypto";

import type { CreatorEnrichmentFeature } from "@/lib/creator-enrichment/enrichment-feature";
import type { CreatorEnrichmentEnqueueOptions } from "@/lib/creator-enrichment/enrichment-feature";
import { priorityForTrigger } from "@/lib/creator-enrichment/policy";
import type {
  CreatorEnrichmentJobPayload,
  EnrichmentScope,
  EnrichmentTrigger,
} from "@/lib/creator-enrichment/types";
import type { RefreshCreatorMetricsOptions } from "@/lib/services/creators/creator-enrichment-service-shared";

import type {
  CreatorEnrichmentBatchRequest,
  CreatorEnrichmentEnqueueRequest,
  CreatorEnrichmentExecuteRequest,
  CreatorEnrichmentRequest,
} from "./types";

export function inferFeature(
  trigger: EnrichmentTrigger,
  options?: Pick<RefreshCreatorMetricsOptions, "isBulk" | "mode">
): CreatorEnrichmentFeature {
  switch (trigger) {
    case "shortlist":
      return "shortlist";
    case "campaign":
      return "campaign_studio";
    case "stale":
      return "dataset_import";
    case "detail":
      return "manual_refresh";
    case "manual":
      if (options?.isBulk) return "batch_refresh";
      return "manual_refresh";
    default:
      return "unknown";
  }
}

/** Prefer explicit caller feature; fall back to trigger-based inference. */
export function resolveFeature(
  trigger: EnrichmentTrigger,
  options?: Pick<RefreshCreatorMetricsOptions, "isBulk" | "mode" | "feature">
): CreatorEnrichmentFeature {
  if (options?.feature) return options.feature;
  return inferFeature(trigger, options);
}

function resolveScope(
  trigger: EnrichmentTrigger,
  scope?: EnrichmentScope
): EnrichmentScope {
  return scope ?? (trigger === "manual" ? "metrics" : "all");
}

export function normalizeRefreshRequest(
  supabase: CreatorEnrichmentRequest["supabase"],
  creatorId: string,
  options: RefreshCreatorMetricsOptions = {}
): CreatorEnrichmentRequest {
  const trigger = options.trigger ?? "manual";
  const scope = resolveScope(trigger, options.scope);
  const dataSource = options.dataSource ?? "live_apify";
  const preferCached = dataSource === "cached_snapshot";
  /** Freshness applies unless an allowed caller sets force (manual / admin / maintenance). */
  const force = preferCached ? false : (options.force ?? false);
  const normalizedOptions: RefreshCreatorMetricsOptions = {
    ...options,
    trigger,
    scope,
    dataSource,
    force,
  };

  return {
    requestId: randomUUID(),
    trigger,
    feature: resolveFeature(trigger, normalizedOptions),
    creatorId: creatorId.trim(),
    platformAccountId: options.platformAccountId ?? null,
    force,
    scope,
    priority: priorityForTrigger(trigger),
    requestedBy: options.requestedBy ?? null,
    timestamp: new Date().toISOString(),
    options: normalizedOptions,
    supabase,
  };
}

export function normalizeEnqueueRequest(
  payload: CreatorEnrichmentJobPayload,
  options?: CreatorEnrichmentEnqueueOptions
): CreatorEnrichmentEnqueueRequest {
  const trigger = payload.trigger;

  return {
    requestId: randomUUID(),
    trigger,
    feature: resolveFeature(trigger, { isBulk: options?.isBulk, feature: options?.feature }),
    creatorId: payload.influencerId,
    payload,
    priority: payload.priority,
    requestedBy: payload.requestedBy ?? null,
    timestamp: new Date().toISOString(),
    isBulk: options?.isBulk,
  };
}

export function normalizeExecuteRequest(
  supabase: CreatorEnrichmentExecuteRequest["supabase"],
  payload: CreatorEnrichmentJobPayload,
  options?: { attempt?: number; jobId?: string | null }
): CreatorEnrichmentExecuteRequest {
  const trigger = payload.trigger;

  return {
    requestId: randomUUID(),
    trigger,
    feature: "worker_execution",
    creatorId: payload.influencerId,
    payload,
    priority: payload.priority,
    requestedBy: payload.requestedBy ?? null,
    timestamp: new Date().toISOString(),
    attempt: options?.attempt,
    jobId: options?.jobId ?? null,
    supabase,
  };
}

export function normalizeBatchRequest(
  supabase: CreatorEnrichmentBatchRequest["supabase"],
  unifiedIds: string[],
  options: RefreshCreatorMetricsOptions = {}
): CreatorEnrichmentBatchRequest {
  const trigger = options.trigger ?? "manual";
  const scope = resolveScope(trigger, options.scope);
  const force = options.force ?? false;
  const normalizedOptions: RefreshCreatorMetricsOptions = {
    ...options,
    trigger,
    scope,
    force,
    isBulk: options.isBulk ?? true,
  };

  return {
    requestId: randomUUID(),
    trigger,
    feature: options.feature ?? "batch_refresh",
    unifiedIds,
    scope,
    priority: priorityForTrigger(trigger),
    requestedBy: options.requestedBy ?? null,
    timestamp: new Date().toISOString(),
    options: normalizedOptions,
    supabase,
  };
}
