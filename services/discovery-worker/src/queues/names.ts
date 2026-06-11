export const QUEUES = {
  discovery: "discovery-run",
  enrichment: "discovery-enrich",
  refresh: "discovery-refresh",
  scheduler: "discovery-scheduler",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
