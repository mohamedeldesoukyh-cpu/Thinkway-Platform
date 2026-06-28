import type { SupabaseClient } from "@supabase/supabase-js";

import {
  refreshCreatorMetrics,
  refreshCreatorMetricsBatch,
} from "@/lib/services/creators/creator-enrichment-service";
import type { Database } from "@/types/database";

import type { CreatorImportEnrichmentJobPayload } from "./types";

/** Queue Apify enrichment for imported creators (one job per influencer). */
export async function queueImportedCreatorEnrichment(
  supabase: SupabaseClient<Database>,
  accounts: Array<{
    influencerId: string;
    platformAccountId: string;
    platform: string;
    username: string;
  }>,
  _importFileId?: string
): Promise<number> {
  const influencerIds = [...new Set(accounts.map((a) => a.influencerId))];
  if (influencerIds.length === 0) return 0;

  // Import uses stale trigger with force=false so the 30-day skip applies.
  // Explicit "Refresh Metrics" always uses force=true via refreshCreatorMetrics.
  const { queued } = await refreshCreatorMetricsBatch(supabase, influencerIds, {
    force: false,
    trigger: "stale",
    mode: "queue",
  });

  return queued;
}

/**
 * Worker handler for legacy `creator-import-enrich` queue jobs.
 * Delegates to the unified Apify enrichment pipeline (inline mode).
 */
export async function enrichImportedPlatformAccount(
  supabase: SupabaseClient<Database>,
  payload: CreatorImportEnrichmentJobPayload
): Promise<{ ok: boolean; message: string }> {
  const result = await refreshCreatorMetrics(supabase, payload.influencerId, {
    force: false,
    trigger: "stale",
    mode: "inline",
  });

  return {
    ok: result.ok,
    message: result.message,
  };
}
