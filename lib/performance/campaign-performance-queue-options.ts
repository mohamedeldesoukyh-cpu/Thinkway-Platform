/** Default BullMQ retention for campaign performance job queues. */
export const CAMPAIGN_PERFORMANCE_JOB_OPTIONS = {
  removeOnComplete: 1000,
  removeOnFail: 100,
} as const;

export const RECENT_QUEUE_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DELAYED_JOB_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
