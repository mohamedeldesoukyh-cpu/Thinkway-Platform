import type { SupabaseClient } from "@supabase/supabase-js";

import {
  creatorHasInflightEnrichmentJob,
} from "@/lib/creator-enrichment/queue-operations";
import { resolveAggregatedCreatorEnrichmentStatus } from "@/lib/creator-enrichment/status-resolution";
import type { CreatorEnrichmentFeature } from "@/lib/creator-enrichment/enrichment-feature";
import type {
  CreatorEnrichmentResult,
  CreatorEnrichmentStatus,
  EnrichmentTrigger,
} from "@/lib/creator-enrichment/types";

export type { CreatorEnrichmentFeature } from "@/lib/creator-enrichment/enrichment-feature";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import type { Database } from "@/types/database";

type AnySupabase = SupabaseClient<Database>;

/** Public sync status surfaced to UI and API consumers. */
export type CreatorMetricsSyncStatus =
  | "pending"
  | "queued"
  | "collecting"
  | "completed"
  | "failed";

export type RefreshCreatorMetricsOptions = {
  /**
   * Bypass freshness when true. Defaults to false.
   * Only Manual Refresh, Admin Force Refresh, and explicit maintenance may set true.
   */
  force?: boolean;
  bypassMetricsManualOverride?: boolean;
  forceAvatarReplace?: boolean;
  forceInterestReplace?: boolean;
  trigger?: EnrichmentTrigger;
  requestedBy?: string | null;
  discoveredProfileId?: string | null;
  mode?: "queue" | "inline";
  attempt?: number;
  jobId?: string | null;
  platformAccountId?: string | null;
  scope?: import("@/lib/creator-enrichment/enabled").EnrichmentScope;
  isBulk?: boolean;
  dataSource?: "cached_snapshot" | "live_apify";
  /**
   * Originating product feature for orchestrator logging.
   * Optional — when omitted the orchestrator infers from trigger and options.
   * Does not affect routing, queue payloads, or enrichment logic.
   */
  feature?: CreatorEnrichmentFeature;
};

export type RefreshCreatorMetricsResult = {
  ok: boolean;
  influencerId: string | null;
  syncStatus: CreatorMetricsSyncStatus;
  queued: boolean;
  message: string;
  jobId?: string;
  enrichment?: CreatorEnrichmentResult;
  refreshSource?: "cached_snapshot" | "live_apify";
  /** True when the decision engine skipped enrichment (e.g. creator already fresh). */
  skipped?: boolean;
};

export type RefreshCreatorMetricsBatchResult = {
  ok: boolean;
  total: number;
  queued: number;
  failed: number;
  results: RefreshCreatorMetricsResult[];
  batchJobId?: string | null;
  acquisitionMode?: "batch_profile" | "per_creator";
  estimatedApifyRuns?: number;
  estimatedCredits?: number;
  batchCount?: number;
  message?: string;
};

export type StopCreatorMetricsRefreshResult = {
  ok: boolean;
  influencerId: string | null;
  stopped: boolean;
  jobsRemoved: number;
  syncStatus: CreatorMetricsSyncStatus;
  message: string;
};

export type StopCreatorMetricsRefreshBatchResult = {
  ok: boolean;
  total: number;
  stopped: number;
  skipped: number;
  results: StopCreatorMetricsRefreshResult[];
};

export function mapEnrichmentStatusToSyncStatus(
  status: CreatorEnrichmentStatus | null | undefined
): CreatorMetricsSyncStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "collecting";
    case "enriched":
    case "partial":
    case "skipped":
      return "completed";
    case "failed":
      return "failed";
    case "awaiting_profile_details":
    case "never":
    default:
      return "pending";
  }
}

export async function resolveCreatorInfluencerId(
  supabase: AnySupabase,
  input: {
    influencerId?: string | null;
    discoveredProfileId?: string | null;
    actorId?: string | null;
  }
): Promise<{ ok: true; influencerId: string } | { ok: false; message: string }> {
  const profileId = input.discoveredProfileId?.trim();

  if (input.influencerId?.trim()) {
    const candidate = input.influencerId.trim();
    const { data: influencer, error } = await supabase
      .from("influencers")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();

    if (error) return { ok: false, message: error.message };
    if (influencer) return { ok: true, influencerId: candidate };

    if (!profileId) {
      return resolveCreatorInfluencerId(supabase, {
        discoveredProfileId: candidate,
        actorId: input.actorId,
      });
    }
  }

  if (!profileId) {
    return { ok: false, message: "A creator or discovered profile id is required." };
  }

  const { data: profile, error } = await supabase
    .from("discovered_profiles")
    .select("id, influencer_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!profile) return { ok: false, message: "Discovered profile not found." };

  if (profile.influencer_id) {
    return { ok: true, influencerId: profile.influencer_id };
  }

  if (!input.actorId) {
    return {
      ok: false,
      message: "Discovery profile must be promoted before metrics refresh.",
    };
  }

  const promoted = await promoteDiscoveredProfileToInfluencer(
    supabase,
    profileId,
    input.actorId
  );
  if (!promoted.ok) {
    return { ok: false, message: promoted.message };
  }
  return { ok: true, influencerId: promoted.influencerId };
}

export async function getCreatorMetricsSyncStatus(
  supabase: AnySupabase,
  influencerId: string
): Promise<CreatorMetricsSyncStatus> {
  const poll = await getCreatorRefreshPollStatus(supabase, influencerId);
  return poll.syncStatus;
}

export type CreatorRefreshPollStatus = {
  syncStatus: CreatorMetricsSyncStatus;
  enrichmentStatus: CreatorEnrichmentStatus | null;
  enrichmentSource: string | null;
  refreshId: string | null;
  failureStage: string | null;
  failureReason: string | null;
};

/** Latest refresh outcome + aggregated sync status for UI poll / toasts. */
export async function getCreatorRefreshPollStatus(
  supabase: AnySupabase,
  influencerId: string
): Promise<CreatorRefreshPollStatus> {
  const [
    { data, error },
    { data: platformRows, error: platformError },
    { data: latestRun },
  ] = await Promise.all([
    supabase
      .from("influencers")
      .select("enrichment_status, enrichment_source, metadata")
      .eq("id", influencerId)
      .maybeSingle(),
    supabase
      .from("influencer_platform_accounts")
      .select("enrichment_status")
      .eq("influencer_id", influencerId),
    supabase
      .from("creator_enrichment_runs")
      .select(
        "refresh_id, failure_stage, error_message, status, execution_trace, created_at"
      )
      .eq("influencer_id", influencerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error || !data) {
    return {
      syncStatus: "pending",
      enrichmentStatus: null,
      enrichmentSource: null,
      refreshId: null,
      failureStage: null,
      failureReason: null,
    };
  }

  const row = data as {
    enrichment_status: CreatorEnrichmentStatus;
    enrichment_source: string | null;
    metadata: Record<string, unknown> | null;
  };

  let resolved: CreatorEnrichmentStatus = row.enrichment_status;
  if (!platformError) {
    const hasInflightJob = await creatorHasInflightEnrichmentJob(influencerId);
    resolved = resolveAggregatedCreatorEnrichmentStatus({
      creatorId: influencerId,
      storedStatus: row.enrichment_status,
      platformStatuses: (platformRows ?? []).map(
        (platformRow) =>
          (platformRow as { enrichment_status: CreatorEnrichmentStatus })
            .enrichment_status
      ),
      hasInflightJob,
    });
  }

  const metaRefresh = (row.metadata?.last_manual_refresh ?? null) as {
    refreshId?: string;
    failureStage?: string | null;
    failureReason?: string | null;
  } | null;

  const run = latestRun as {
    refresh_id?: string | null;
    failure_stage?: string | null;
    error_message?: string | null;
    status?: string | null;
    execution_trace?: { failureStage?: string | null; failureReason?: string | null } | null;
  } | null;

  return {
    syncStatus: mapEnrichmentStatusToSyncStatus(resolved),
    enrichmentStatus: resolved,
    enrichmentSource: row.enrichment_source ?? null,
    refreshId: run?.refresh_id ?? metaRefresh?.refreshId ?? null,
    failureStage:
      run?.failure_stage ??
      run?.execution_trace?.failureStage ??
      metaRefresh?.failureStage ??
      null,
    failureReason:
      run?.error_message ??
      run?.execution_trace?.failureReason ??
      metaRefresh?.failureReason ??
      null,
  };
}
