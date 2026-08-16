import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";

export type MetricsEnrichmentStatusRow = {
  id: string;
  influencer_id?: string | null;
  metrics_refresh_status?: string | null;
};

const IN_FLIGHT = new Set(["queued", "collecting"]);
const TERMINAL = new Set([
  "completed",
  "partial",
  "failed",
  "manual_required",
]);

export function emptyMetricsEnrichmentHealth(): CampaignMetricsSyncHealth {
  return {
    synced: 0,
    partial: 0,
    failed: 0,
    manual_required: 0,
    queued: 0,
    collecting: 0,
    total: 0,
  };
}

/** Summarize a refresh batch using the same buckets as Sync health. */
export function summarizeMetricsEnrichmentBatch(
  rows: readonly MetricsEnrichmentStatusRow[],
  batchIds: readonly string[]
): CampaignMetricsSyncHealth {
  const allowed = new Set(batchIds);
  const health = emptyMetricsEnrichmentHealth();
  health.total = batchIds.length;

  for (const row of rows) {
    if (!allowed.has(row.id)) continue;
    const status = row.metrics_refresh_status ?? "pending";
    if (status === "completed") health.synced += 1;
    else if (status === "partial") health.partial += 1;
    else if (status === "failed") health.failed += 1;
    else if (status === "manual_required") health.manual_required += 1;
    else if (status === "queued") health.queued += 1;
    else if (status === "collecting") health.collecting += 1;
  }

  return health;
}

export function countMetricsEnrichmentSettled(
  health: Pick<
    CampaignMetricsSyncHealth,
    "synced" | "partial" | "failed" | "manual_required" | "total"
  >
): number {
  return health.synced + health.partial + health.failed + health.manual_required;
}

export function metricsEnrichmentProgressPercent(
  health: CampaignMetricsSyncHealth
): number {
  if (health.total <= 0) return 0;
  return Math.min(
    100,
    Math.round((countMetricsEnrichmentSettled(health) / health.total) * 100)
  );
}

export function isMetricsEnrichmentBatchComplete(
  health: CampaignMetricsSyncHealth
): boolean {
  if (health.total <= 0) return false;
  return (
    countMetricsEnrichmentSettled(health) >= health.total &&
    health.queued === 0 &&
    health.collecting === 0
  );
}

export function isMetricsEnrichmentStatusInFlight(
  status?: string | null
): boolean {
  return status != null && IN_FLIGHT.has(status);
}

export function isMetricsEnrichmentStatusTerminal(
  status?: string | null
): boolean {
  return status != null && TERMINAL.has(status);
}

/** Unique creators represented in the batch (fallback to publication id). */
export function countUniqueCreatorsInBatch(
  rows: readonly MetricsEnrichmentStatusRow[],
  batchIds: readonly string[]
): number {
  const allowed = new Set(batchIds);
  const keys = new Set<string>();
  for (const row of rows) {
    if (!allowed.has(row.id)) continue;
    keys.add(row.influencer_id?.trim() || row.id);
  }
  return keys.size;
}
