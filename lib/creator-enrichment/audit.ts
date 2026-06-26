/**
 * Audit logging for creator enrichment runs (table: creator_enrichment_runs).
 * Best-effort — audit failures never abort enrichment.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EnrichmentPriority, EnrichmentTrigger } from "./types";

export type EnrichmentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "skipped"
  | "failed"
  | "dead_letter";

export type EnrichmentRunInput = {
  influencerId: string;
  platformAccountId?: string | null;
  discoveredProfileId?: string | null;
  trigger: EnrichmentTrigger;
  priority: EnrichmentPriority;
  status: EnrichmentRunStatus;
  source?: string | null;
  apifyRunId?: string | null;
  forced?: boolean;
  skippedReason?: string | null;
  fieldsUpdated?: string[];
  attempt?: number;
  errorMessage?: string | null;
  jobId?: string | null;
  requestedBy?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export async function writeEnrichmentRun(
  supabase: SupabaseClient,
  input: EnrichmentRunInput
): Promise<void> {
  try {
    const { error } = await supabase.from("creator_enrichment_runs").insert({
      influencer_id: input.influencerId,
      platform_account_id: input.platformAccountId ?? null,
      discovered_profile_id: input.discoveredProfileId ?? null,
      trigger: input.trigger,
      priority: input.priority,
      status: input.status,
      source: input.source ?? null,
      apify_run_id: input.apifyRunId ?? null,
      forced: input.forced ?? false,
      skipped_reason: input.skippedReason ?? null,
      fields_updated: input.fieldsUpdated ?? [],
      attempt: input.attempt ?? 1,
      error_message: input.errorMessage ?? null,
      job_id: input.jobId ?? null,
      requested_by: input.requestedBy ?? null,
      started_at: input.startedAt ?? null,
      completed_at: input.completedAt ?? null,
    } as never);
    if (error) {
      console.error("[creator-enrichment] audit insert failed", error.message);
    }
  } catch (error) {
    console.error(
      "[creator-enrichment] audit insert threw",
      error instanceof Error ? error.message : error
    );
  }
}
