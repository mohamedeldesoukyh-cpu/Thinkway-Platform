/**
 * Product surface that initiated a creator enrichment request.
 * Used for orchestrator logging and observability only — not stored on queue payloads.
 */
export type CreatorEnrichmentFeature =
  | "manual_refresh"
  | "add_creator"
  | "add_platform"
  | "campaign_studio"
  | "batch_refresh"
  | "shortlist"
  | "dataset_import"
  | "worker_execution"
  | "unknown";

/** Options passed to public enqueue helpers (orchestrator observability only). */
export type CreatorEnrichmentEnqueueOptions = {
  isBulk?: boolean;
  /** Explicit product feature; falls back to trigger-based inference when omitted. */
  feature?: CreatorEnrichmentFeature;
};
