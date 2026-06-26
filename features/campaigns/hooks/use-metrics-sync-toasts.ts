"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";

const ACTIVE_METRICS_SYNC_STATUSES = new Set(["pending", "queued", "collecting"]);
const TERMINAL_METRICS_SYNC_STATUSES = new Set([
  "completed",
  "partial",
  "failed",
  "manual_required",
]);

export function metricsSyncToastId(publicationId: string): string {
  return `metrics-sync-${publicationId}`;
}

export function notifyMetricsSyncQueued(
  publicationId: string,
  label?: string | null
): void {
  const name = label?.trim();
  toast.loading(name ? `Collecting metrics for ${name}…` : "Collecting metrics…", {
    id: metricsSyncToastId(publicationId),
  });
}

function publicationLabel(row: Pick<CampaignPublicationRow, "influencer_name" | "platform_label">): string {
  return row.influencer_name?.trim() || row.platform_label || "Publication";
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

      if (status != null && ACTIVE_METRICS_SYNC_STATUSES.has(status)) {
        if (prior == null || !ACTIVE_METRICS_SYNC_STATUSES.has(prior)) {
          toast.loading(`Collecting metrics for ${label}…`, { id: toastId });
        }
      }

      if (
        prior != null &&
        ACTIVE_METRICS_SYNC_STATUSES.has(prior) &&
        status != null &&
        TERMINAL_METRICS_SYNC_STATUSES.has(status)
      ) {
        if (status === "completed" || status === "partial") {
          toast.success(`Metrics updated for ${label}.`, { id: toastId });
        } else if (status === "failed") {
          toast.error(`Metrics collection failed for ${label}.`, { id: toastId });
        } else {
          toast.info(`Metrics sync finished for ${label} (${status.replace(/_/g, " ")}).`, {
            id: toastId,
          });
        }
      }

      previous.set(id, status);
    }
  }, [publications]);
}
