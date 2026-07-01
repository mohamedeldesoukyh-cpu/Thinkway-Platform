export const QUEUES = {
  discovery: "discovery-run",
  enrichment: "discovery-enrich",
  refresh: "discovery-refresh",
  scheduler: "discovery-scheduler",
  publicationMetrics: "publication-metrics",
  publicationMetricsScheduler: "publication-metrics-scheduler",
  publicationScreenshot: "publication-screenshot",
  publicationScreenshotScheduler: "publication-screenshot-scheduler",
  creatorImport: "creator-import",
  creatorImportChunk: "creator-import-chunk",
  creatorImportEnrich: "creator-import-enrich",
  /** Phase 3 — commercial creator enrichment (Apify), priorities 1..4. */
  creatorEnrichment: "creator-enrichment",
  creatorEnrichmentDlq: "creator-enrichment-dlq",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
