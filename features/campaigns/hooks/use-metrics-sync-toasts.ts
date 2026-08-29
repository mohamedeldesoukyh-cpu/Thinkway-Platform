"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import {
  shouldCompleteMetricsSyncToast,
  shouldShowMetricsSyncLoadingToast,
} from "@/features/campaigns/hooks/metrics-sync-poll-policy";

/** Survives hook remount so Refresh metrics loading toasts can still complete. */
const pendingMetricsSyncToastIds = new Set<string>();

export function metricsSyncToastId(publicationId: string): string {
  return `metrics-sync-${publicationId}`;
}

export function notifyMetricsSyncQueued(
  publicationId: string,
  label?: string | null
): void {
  pendingMetricsSyncToastIds.add(publicationId);
  const name = label?.trim();
  toast.loading(name ? `Collecting metrics for ${name}…` : "Collecting metrics…", {
    id: metricsSyncToastId(publicationId),
  });
}

function publicationLabel(row: Pick<CampaignPublicationRow, "influencer_name" | "platform_label">): string {
  return row.influencer_name?.trim() || row.platform_label || "Publication";
}

function completeMetricsSyncToast(toastId: string, status: string, label: string): void {
  if (status === "completed" || status === "partial") {
    toast.success(`Metrics updated for ${label}.`, { id: toastId });
    return;
  }
  if (status === "failed") {
    toast.error(`Metrics collection failed for ${label}.`, { id: toastId });
    return;
  }
  toast.info(`Metrics sync finished for ${label} (${status.replace(/_/g, " ")}).`, {
    id: toastId,
  });
}

/**
 * Keeps metrics sync toasts in sync with publication rows: loading while queued/collecting,
 * success/error when a terminal status is reached (via polling or inline refresh).
 */
export function useMetricsSyncCompletionToasts(
  publications: CampaignPublicationRow[]
): void {
  const previousStatusRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    const previous = previousStatusRef.current;

    for (const row of publications) {
      const id = row.id;
      const status = row.metrics_refresh_status ?? null;
      const prior = previous.get(id);
      const toastId = metricsSyncToastId(id);
      const label = publicationLabel(row);

      if (shouldShowMetricsSyncLoadingToast(prior, status)) {
        pendingMetricsSyncToastIds.add(id);
        toast.loading(`Collecting metrics for ${label}…`, { id: toastId });
      }

      if (
        shouldCompleteMetricsSyncToast({
          priorStatus: prior,
          nextStatus: status,
          toastWasShown: pendingMetricsSyncToastIds.has(id),
        })
      ) {
        completeMetricsSyncToast(toastId, status as string, label);
        pendingMetricsSyncToastIds.delete(id);
      }

      previous.set(id, status);
    }
  }, [publications]);
}
