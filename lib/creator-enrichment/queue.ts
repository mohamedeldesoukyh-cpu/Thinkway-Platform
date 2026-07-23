/**
 * Enqueue helper for the `creator-enrichment` queue.
 *
 * ALWAYS best-effort and non-blocking: every trigger (shortlist add, campaign
 * move, detail open, manual refresh) calls this in a way that can NEVER fail the
 * primary action. If Redis is not configured we no-op silently.
 *
 * Public enqueue functions route through {@link CreatorEnrichmentOrchestrator}.
 */

import type { CreatorEnrichmentEnqueueOptions } from "@/lib/creator-enrichment/enrichment-feature";
import { getCreatorEnrichmentOrchestrator } from "@/lib/creator-enrichment/orchestrator";

import type { CreatorEnrichmentJobPayload, EnqueueResult } from "./types";

export {
  cancelCreatorEnrichmentJobs,
  creatorHasInflightEnrichmentJob,
  getCreatorEnrichmentQueueStats,
  isCreatorEnrichmentQueueAvailable,
  type CancelCreatorEnrichmentJobsResult,
  type CreatorEnrichmentQueueStats,
} from "./queue-operations";

export async function enqueueCreatorEnrichment(
  payload: CreatorEnrichmentJobPayload,
  options?: CreatorEnrichmentEnqueueOptions
): Promise<EnqueueResult> {
  return getCreatorEnrichmentOrchestrator().enqueue(payload, options);
}

/**
 * Fire-and-forget wrapper for use inside server actions. Swallows every error so
 * an enrichment hiccup can never roll back the primary mutation.
 */
export function enqueueCreatorEnrichmentBestEffort(
  payload: CreatorEnrichmentJobPayload,
  options?: Pick<CreatorEnrichmentEnqueueOptions, "feature">
): void {
  getCreatorEnrichmentOrchestrator().enqueueBestEffort(payload, options);
}
