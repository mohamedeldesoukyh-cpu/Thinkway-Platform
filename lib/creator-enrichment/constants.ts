/** Phase 3 creator-enrichment constants shared by app + worker. */

/** BullMQ queue that processes commercial creator enrichment. */
export const CREATOR_ENRICHMENT_QUEUE = "creator-enrichment" as const;

/** Dead-letter queue for jobs that exhaust all retries. */
export const CREATOR_ENRICHMENT_DLQ = "creator-enrichment-dlq" as const;

/** Skip automated enrichment if the creator was enriched within this window. */
export const ENRICHMENT_STALE_AFTER_DAYS = 30;

/** Retry policy for the worker (exponential backoff). */
export const CREATOR_ENRICHMENT_JOB_ATTEMPTS = 3;
export const CREATOR_ENRICHMENT_BACKOFF_DELAY_MS = 5_000;

/** BullMQ job retention. */
export const CREATOR_ENRICHMENT_REMOVE_ON_COMPLETE = 1_000;
export const CREATOR_ENRICHMENT_REMOVE_ON_FAIL = 500;

/**
 * Permission required to trigger a manual refresh. Reuses discovery write,
 * matching the shortlist permission model.
 */
export const CREATOR_ENRICHMENT_PERMISSION = "discovery.write" as const;
