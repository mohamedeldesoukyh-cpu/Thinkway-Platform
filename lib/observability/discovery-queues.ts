/** BullMQ queue names used by the discovery worker (shared with health probes). */
export const DISCOVERY_WORKER_QUEUES = [
  "discovery-run",
  "enterprise-acquisition",
  "discovery-enrich",
  "discovery-refresh",
  "discovery-scheduler",
  "publication-metrics",
  "publication-metrics-scheduler",
  "publication-screenshot",
  "publication-screenshot-scheduler",
  "creator-import",
  "creator-import-chunk",
  "creator-import-enrich",
  "creator-enrichment",
  "creator-enrichment-dlq",
  "batch-profile-acquisition",
  "performance-report",
] as const;

export type DiscoveryQueueName = (typeof DISCOVERY_WORKER_QUEUES)[number];
