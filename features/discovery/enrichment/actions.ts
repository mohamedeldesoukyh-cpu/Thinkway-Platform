"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  enqueueCreatorEnrichment,
  isCreatorEnrichmentQueueAvailable,
} from "@/lib/creator-enrichment/queue";
import { priorityForTrigger } from "@/lib/creator-enrichment/policy";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import type { CreatorEnrichmentJobPayload } from "@/lib/creator-enrichment/types";

export type EnrichmentActionResult = {
  ok: boolean;
  queued: boolean;
  message: string;
};

/**
 * Explicit "Refresh Creator" click (spec §1/§3, priority 4). Forces a run,
 * bypassing the 30-day freshness skip.
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

  if (!isCreatorEnrichmentQueueAvailable()) {
    return {
      ok: false,
      queued: false,
      message: "Enrichment queue is not configured.",
    };
  }

  const payload: CreatorEnrichmentJobPayload = {
    influencerId,
    trigger: "manual",
    priority: priorityForTrigger("manual"),
    force: true,
    requestedBy: auth.userId,
  };

  const result = await enqueueCreatorEnrichment(payload);
  if (!result.queued) {
    return {
      ok: false,
      queued: false,
      message: result.reason ?? "Could not queue enrichment.",
    };
  }

  // Reflect "queued" immediately so the UI can show the pending state.
  await supabase
    .from("influencers")
    .update({ enrichment_status: "queued" } as never)
    .eq("id", influencerId);

  return { ok: true, queued: true, message: "Refresh queued." };
}

/**
 * Detail-view trigger (spec §2.B, priority 3). Best-effort, respects the 30-day
 * skip (force=false). Safe to call on every sheet open — de-duped by job id and
 * skipped in the worker when fresh.
 */
export async function enqueueCreatorDetailEnrichment(
  influencerId: string
): Promise<EnrichmentActionResult> {
  if (!influencerId || !isCreatorEnrichmentQueueAvailable()) {
    return { ok: true, queued: false, message: "No enrichment queued." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    // Detail view is read-mostly; never surface a hard error for a background hint.
    return { ok: true, queued: false, message: "No enrichment queued." };
  }

  const result = await enqueueCreatorEnrichment({
    influencerId,
    trigger: "detail",
    priority: priorityForTrigger("detail"),
    force: false,
    requestedBy: auth.userId,
  });

  return {
    ok: true,
    queued: result.queued,
    message: result.queued ? "Enrichment queued." : "No enrichment queued.",
  };
}
