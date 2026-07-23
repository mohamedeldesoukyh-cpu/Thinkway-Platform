import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreatorEnrichmentEnqueueOptions,
  CreatorEnrichmentFeature,
} from "@/lib/creator-enrichment/enrichment-feature";
import type {
  CreatorEnrichmentJobPayload,
  CreatorEnrichmentResult,
  EnrichmentPriority,
  EnrichmentScope,
  EnrichmentTrigger,
  EnqueueResult,
} from "@/lib/creator-enrichment/types";
import type {
  RefreshCreatorMetricsBatchResult,
  RefreshCreatorMetricsOptions,
  RefreshCreatorMetricsResult,
} from "@/lib/services/creators/creator-enrichment-service-shared";
import type { Database } from "@/types/database";

export type { CreatorEnrichmentFeature } from "@/lib/creator-enrichment/enrichment-feature";
type AnySupabase = SupabaseClient<Database>;

/** Normalized enrichment request passed through the orchestrator. */
export type CreatorEnrichmentRequest = {
  requestId: string;
  trigger: EnrichmentTrigger;
  feature: CreatorEnrichmentFeature;
  creatorId: string;
  platformAccountId?: string | null;
  force: boolean;
  scope: EnrichmentScope;
  priority: EnrichmentPriority;
  requestedBy?: string | null;
  timestamp: string;
  /** Original caller options — forwarded unchanged to existing implementation. */
  options: RefreshCreatorMetricsOptions;
  supabase: AnySupabase;
};

/** Normalized orchestrator response (wraps existing outputs). */
export type CreatorEnrichmentResponse<T> = {
  requestId: string;
  status: "completed" | "failed";
  delegatedTo: string;
  durationMs: number;
  result: T;
};

export type CreatorEnrichmentEnqueueRequest = {
  requestId: string;
  trigger: EnrichmentTrigger;
  feature: CreatorEnrichmentFeature;
  creatorId: string;
  payload: CreatorEnrichmentJobPayload;
  priority: EnrichmentPriority;
  requestedBy?: string | null;
  timestamp: string;
  isBulk?: boolean;
};

export type CreatorEnrichmentEnqueueResponse = {
  requestId: string;
  status: "completed" | "failed";
  delegatedTo: string;
  durationMs: number;
  result: EnqueueResult;
};

export type CreatorEnrichmentExecuteRequest = {
  requestId: string;
  trigger: EnrichmentTrigger;
  feature: CreatorEnrichmentFeature;
  creatorId: string;
  payload: CreatorEnrichmentJobPayload;
  priority: EnrichmentPriority;
  requestedBy?: string | null;
  timestamp: string;
  attempt?: number;
  jobId?: string | null;
  supabase: AnySupabase;
};

export type CreatorEnrichmentExecuteResponse = {
  requestId: string;
  status: "completed" | "failed";
  delegatedTo: string;
  durationMs: number;
  result: CreatorEnrichmentResult;
};

export type CreatorEnrichmentBatchRequest = {
  requestId: string;
  trigger: EnrichmentTrigger;
  feature: CreatorEnrichmentFeature;
  /** No single creatorId — batch spans multiple unified ids (see unifiedIds). */
  unifiedIds: string[];
  scope: EnrichmentScope;
  priority: EnrichmentPriority;
  requestedBy?: string | null;
  timestamp: string;
  options: RefreshCreatorMetricsOptions;
  supabase: AnySupabase;
};

export type CreatorEnrichmentBatchResponse = {
  requestId: string;
  status: "completed" | "failed";
  delegatedTo: string;
  durationMs: number;
  result: RefreshCreatorMetricsBatchResult;
};

export type RefreshMetricsDelegate = (
  supabase: AnySupabase,
  creatorId: string,
  options?: RefreshCreatorMetricsOptions
) => Promise<RefreshCreatorMetricsResult>;

export type EnqueueDelegate = (
  payload: CreatorEnrichmentJobPayload,
  options?: CreatorEnrichmentEnqueueOptions
) => Promise<EnqueueResult>;

export type ExecuteJobDelegate = (
  supabase: AnySupabase,
  payload: CreatorEnrichmentJobPayload,
  options?: { attempt?: number; jobId?: string | null }
) => Promise<CreatorEnrichmentResult>;

export type BatchRefreshDelegate = (
  supabase: AnySupabase,
  unifiedIds: string[],
  options?: RefreshCreatorMetricsOptions
) => Promise<RefreshCreatorMetricsBatchResult>;
