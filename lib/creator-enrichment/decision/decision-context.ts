import type {
  CreatorEnrichmentBatchRequest,
  CreatorEnrichmentEnqueueRequest,
  CreatorEnrichmentExecuteRequest,
  CreatorEnrichmentRequest,
} from "@/lib/creator-enrichment/orchestrator/types";

import type { DecisionContextFields } from "./decision-types";

/** Normalized immutable decision context — request metadata only, no I/O. */
export type CreatorEnrichmentDecisionContext = Readonly<DecisionContextFields>;

function freezeContext(
  fields: DecisionContextFields
): CreatorEnrichmentDecisionContext {
  return Object.freeze({ ...fields });
}

export function buildDecisionContextFromRefreshRequest(
  request: CreatorEnrichmentRequest,
  delegatedTo: string
): CreatorEnrichmentDecisionContext {
  return freezeContext({
    requestId: request.requestId,
    feature: request.feature,
    trigger: request.trigger,
    priority: request.priority,
    creatorId: request.creatorId,
    platformAccountId: request.platformAccountId ?? null,
    force: request.force,
    scope: request.scope,
    requestedBy: request.requestedBy ?? null,
    timestamp: request.timestamp,
    operation: "refresh",
    delegatedTo,
    supabase: request.supabase,
  });
}

export function buildDecisionContextFromEnqueueRequest(
  request: CreatorEnrichmentEnqueueRequest,
  delegatedTo: string
): CreatorEnrichmentDecisionContext {
  return freezeContext({
    requestId: request.requestId,
    feature: request.feature,
    trigger: request.trigger,
    priority: request.priority,
    creatorId: request.creatorId,
    platformAccountId: request.payload.platformAccountId ?? null,
    force: request.payload.force ?? false,
    scope: request.payload.scope ?? "all",
    requestedBy: request.requestedBy ?? null,
    timestamp: request.timestamp,
    operation: "enqueue",
    delegatedTo,
    supabase: null,
  });
}

export function buildDecisionContextFromExecuteRequest(
  request: CreatorEnrichmentExecuteRequest,
  delegatedTo: string
): CreatorEnrichmentDecisionContext {
  return freezeContext({
    requestId: request.requestId,
    feature: request.feature,
    trigger: request.trigger,
    priority: request.priority,
    creatorId: request.creatorId,
    platformAccountId: request.payload.platformAccountId ?? null,
    force: request.payload.force ?? false,
    scope: request.payload.scope ?? "all",
    requestedBy: request.requestedBy ?? null,
    timestamp: request.timestamp,
    operation: "execute",
    delegatedTo,
    supabase: request.supabase,
  });
}

export function buildDecisionContextFromBatchRequest(
  request: CreatorEnrichmentBatchRequest,
  delegatedTo: string
): CreatorEnrichmentDecisionContext {
  return freezeContext({
    requestId: request.requestId,
    feature: request.feature,
    trigger: request.trigger,
    priority: request.priority,
    /** Batch spans multiple creators — no single creatorId at decision time. */
    creatorId: null,
    platformAccountId: request.options.platformAccountId ?? null,
    force: request.options.force ?? false,
    scope: request.scope,
    requestedBy: request.requestedBy ?? null,
    timestamp: request.timestamp,
    operation: "batch",
    delegatedTo,
    supabase: request.supabase,
  });
}
