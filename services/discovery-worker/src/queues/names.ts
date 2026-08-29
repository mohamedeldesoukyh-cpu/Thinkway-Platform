export const QUEUES = {
  discovery: "discovery-run",
  enrichment: "discovery-enrich",
  enterpriseAcquisition: "enterprise-acquisition",
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
  /** Batch profile acquisition — many URLs per Apify actor run. */
  batchProfileAcquisition: "batch-profile-acquisition",
  campaignScriptTranslate: "campaign-script-translate",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
