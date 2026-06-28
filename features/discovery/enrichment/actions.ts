"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import {
  refreshCreatorMetrics,
  refreshCreatorMetricsBatchByUnifiedIds,
} from "@/lib/services/creators/creator-enrichment-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EnrichmentActionResult = {
  ok: boolean;
  queued: boolean;
  message: string;
  queuedCount?: number;
};

/**
 * Explicit "Refresh Metrics" click. Forces a run, bypassing the 30-day skip.
 */
export async function refreshCreatorAction(
  influencerId: string
): Promise<EnrichmentActionResult> {
  if (!influencerId) {
    return { ok: false, queued: false, message: "A creator id is required." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, queued: false, message: auth.error };
  }

  const result = await refreshCreatorMetrics(supabase, influencerId, {
    force: true,
    trigger: "manual",
    requestedBy: auth.userId,
  });

  return {
    ok: result.ok,
    queued: result.queued,
    message: result.message,
  };
}

/** Batch refresh for selected creators in Discovery Search / Import Center demos. */
export async function refreshCreatorsBatchAction(
  unifiedIds: string[]
): Promise<EnrichmentActionResult> {
  if (unifiedIds.length === 0) {
    return { ok: false, queued: false, message: "Select at least one creator." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, queued: false, message: auth.error };
  }

  const batch = await refreshCreatorMetricsBatchByUnifiedIds(supabase, unifiedIds, {
    force: true,
    trigger: "manual",
    requestedBy: auth.userId,
  });

  return {
    ok: batch.ok,
    queued: batch.queued > 0,
    queuedCount: batch.queued,
    message:
      batch.queued > 0
        ? `Queued ${batch.queued} of ${batch.total} creator refresh(es).`
        : batch.failed > 0
          ? `${batch.failed} refresh(es) could not be queued.`
          : "No creators queued.",
  };
}

/**
 * Detail-view trigger (priority 3). Best-effort, respects the 30-day skip.
 * Safe to call on every sheet open — de-duped by job id and skipped when fresh.
 */
export async function enqueueCreatorDetailEnrichment(
  influencerId: string
): Promise<EnrichmentActionResult> {
  if (!influencerId) {
    return { ok: true, queued: false, message: "No enrichment queued." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: true, queued: false, message: "No enrichment queued." };
  }

  const result = await refreshCreatorMetrics(supabase, influencerId, {
    force: false,
    trigger: "detail",
    requestedBy: auth.userId,
  });

  return {
    ok: true,
    queued: result.queued,
    message: result.queued ? "Enrichment queued." : "No enrichment queued.",
  };
}
