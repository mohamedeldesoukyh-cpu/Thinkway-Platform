"use client";

import { toast } from "sonner";

import {
  formatBulkOperationSummary,
  type BulkOperationProgress,
  type BulkOperationSummary,
} from "@/components/workspace/bulk-operations/run-bulk-operation";

const TOAST_ID = "thinkway-bulk-operation";

export function reportBulkProgress(progress: BulkOperationProgress) {
  const entity = progress.entityLabelPlural || "items";
  toast.loading(`Updating ${entity}`, {
    id: TOAST_ID,
    description: `${progress.completed} of ${progress.total} processed · ${progress.succeeded} successful · ${progress.failed} failed · ${progress.remaining} remaining`,
  });
}

export function reportBulkSummary(
  summary: BulkOperationSummary,
  options?: { onRetryFailed?: (failedIds: string[]) => void }
) {
  const formatted = formatBulkOperationSummary(summary);

  if (formatted.tone === "success") {
    toast.success(formatted.title, {
      id: TOAST_ID,
      description: formatted.description,
    });
    return;
  }

  if (formatted.tone === "error") {
    toast.error(formatted.title, {
      id: TOAST_ID,
      description: formatted.description,
      action:
        summary.failedIds.length > 0 && options?.onRetryFailed
          ? {
              label: "Retry Failed",
              onClick: () => options.onRetryFailed?.(summary.failedIds),
            }
          : undefined,
    });
    return;
  }

  toast.warning(formatted.title, {
    id: TOAST_ID,
    description: formatted.description,
    action:
      summary.failedIds.length > 0 && options?.onRetryFailed
        ? {
            label: "Retry Failed",
            onClick: () => options.onRetryFailed?.(summary.failedIds),
          }
        : undefined,
  });
}
