"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import {
  countUniqueCreatorsInBatch,
  emptyMetricsEnrichmentHealth,
  isMetricsEnrichmentBatchComplete,
  isMetricsEnrichmentStatusInFlight,
  metricsEnrichmentProgressPercent,
  summarizeMetricsEnrichmentBatch,
} from "@/lib/performance/metrics-enrichment-batch";

export type MetricsEnrichmentBatchState = {
  active: boolean;
  batchIds: string[];
  health: CampaignMetricsSyncHealth;
  progressPercent: number;
  creatorCount: number;
  summaryOpen: boolean;
  summaryHealth: CampaignMetricsSyncHealth | null;
  summaryCreatorCount: number;
  startBatch: (publicationIds: string[]) => void;
  dismissSummary: () => void;
};

/**
 * Tracks a metrics refresh batch for progress UI + completion summary.
 * Arms only after queued/collecting is observed (or a short fallback), so a
 * stale pre-refresh "completed" snapshot cannot open the summary early.
 */
export function useMetricsEnrichmentBatch(
  publications: CampaignPublicationRow[]
): MetricsEnrichmentBatchState {
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryHealth, setSummaryHealth] = useState<CampaignMetricsSyncHealth | null>(
    null
  );
  const [summaryCreatorCount, setSummaryCreatorCount] = useState(0);
  const completedBatchKeyRef = useRef<string | null>(null);
  const armedRef = useRef(false);

  const health = useMemo(() => {
    if (batchIds.length === 0) return emptyMetricsEnrichmentHealth();
    return summarizeMetricsEnrichmentBatch(publications, batchIds);
  }, [batchIds, publications]);

  const progressPercent = metricsEnrichmentProgressPercent(health);
  const creatorCount = useMemo(
    () => countUniqueCreatorsInBatch(publications, batchIds),
    [batchIds, publications]
  );

  useEffect(() => {
    if (batchIds.length === 0) {
      armedRef.current = false;
      return;
    }

    const anyInFlight = batchIds.some((id) => {
      const row = publications.find((publication) => publication.id === id);
      return isMetricsEnrichmentStatusInFlight(row?.metrics_refresh_status);
    });
    if (anyInFlight) armedRef.current = true;

    const fallback = window.setTimeout(() => {
      armedRef.current = true;
    }, 2500);

    return () => window.clearTimeout(fallback);
  }, [batchIds, publications]);

  useEffect(() => {
    if (batchIds.length === 0) return;
    if (!armedRef.current) return;
    if (!isMetricsEnrichmentBatchComplete(health)) return;

    const key = [...batchIds].sort().join(",");
    if (completedBatchKeyRef.current === key) return;
    completedBatchKeyRef.current = key;

    setSummaryHealth(health);
    setSummaryCreatorCount(creatorCount);
    setSummaryOpen(true);
    setBatchIds([]);
  }, [batchIds, creatorCount, health]);

  const startBatch = useCallback((publicationIds: string[]) => {
    const unique = [...new Set(publicationIds.filter(Boolean))];
    if (unique.length === 0) return;
    completedBatchKeyRef.current = null;
    armedRef.current = false;
    setSummaryOpen(false);
    setSummaryHealth(null);
    setBatchIds(unique);
  }, []);

  const dismissSummary = useCallback(() => {
    setSummaryOpen(false);
  }, []);

  return {
    active: batchIds.length > 0,
    batchIds,
    health,
    progressPercent,
    creatorCount,
    summaryOpen,
    summaryHealth,
    summaryCreatorCount,
    startBatch,
    dismissSummary,
  };
}
