"use client";
import { useRefreshMetricsProgressCircle } from "@/features/discovery/enrichment/use-refresh-metrics-progress-circle";
import { RefreshMetricsProgressCircle } from "@/features/discovery/enrichment/components/refresh-metrics-progress-circle";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";

export function QuotationEnrichmentProgress({ status }: { status?: CreatorEnrichmentStatus | null }) {
  const progress = useRefreshMetricsProgressCircle({ enrichmentStatus: status });
  if (!progress) return null;
  return <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground" aria-live="polite">
    <RefreshMetricsProgressCircle progress={progress} size="sm" />
    {status === "queued" ? "Queued" : status === "running" ? "Enriching…" : progress.label}
  </span>;
}
