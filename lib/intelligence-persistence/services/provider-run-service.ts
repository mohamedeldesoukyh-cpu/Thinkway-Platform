/**
 * Provider run metadata persistence — credits, duration, cost, errors.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { IplProvider, IplProviderRunStatus } from "../types";

type AnySupabase = SupabaseClient;

export type CreateProviderRunInput = {
  provider: IplProvider;
  influencerId?: string | null;
  platformAccountId?: string | null;
  discoveredProfileId?: string | null;
  platform?: string | null;
  profileUrl?: string | null;
  externalRunId?: string | null;
  status?: IplProviderRunStatus;
  metadata?: Record<string, unknown>;
};

export type CompleteProviderRunInput = {
  runId: string;
  status: IplProviderRunStatus;
  externalRunId?: string | null;
  creditsUsed?: number | null;
  durationMs?: number | null;
  estimatedCostUsd?: number | null;
  payloadBytes?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createProviderRun(
  supabase: AnySupabase,
  input: CreateProviderRunInput
): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("ipl_provider_runs")
      .insert({
        provider: input.provider,
        status: input.status ?? "running",
        influencer_id: input.influencerId ?? null,
        platform_account_id: input.platformAccountId ?? null,
        discovered_profile_id: input.discoveredProfileId ?? null,
        platform: input.platform ?? null,
        profile_url: input.profileUrl ?? null,
        external_run_id: input.externalRunId ?? null,
        metadata: input.metadata ?? {},
        started_at: now,
      } as never)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[ipl] provider run insert failed", error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (error) {
    console.error(
      "[ipl] provider run insert threw",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function completeProviderRun(
  supabase: AnySupabase,
  input: CompleteProviderRunInput
): Promise<void> {
  try {
    const { error } = await supabase
      .from("ipl_provider_runs")
      .update({
        status: input.status,
        external_run_id: input.externalRunId ?? undefined,
        credits_used: input.creditsUsed ?? null,
        duration_ms: input.durationMs ?? null,
        estimated_cost_usd: input.estimatedCostUsd ?? null,
        payload_bytes: input.payloadBytes ?? null,
        error_message: input.errorMessage ?? null,
        metadata: input.metadata ?? undefined,
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", input.runId);

    if (error) {
      console.error("[ipl] provider run update failed", error.message);
    }
  } catch (error) {
    console.error(
      "[ipl] provider run update threw",
      error instanceof Error ? error.message : error
    );
  }
}
