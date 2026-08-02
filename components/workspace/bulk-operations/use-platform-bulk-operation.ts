"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  reportBulkProgress,
  reportBulkSummary,
} from "@/components/workspace/bulk-operations/bulk-operation-feedback";
import {
  runBulkOperation,
  type BulkMutateFn,
  type BulkOperationSummary,
  type RunBulkOperationInput,
} from "@/components/workspace/bulk-operations/run-bulk-operation";

type ActiveJob = {
  label: string;
  entityLabelPlural: string;
  startedAt: number;
};

type JobListener = (job: ActiveJob | null) => void;

/** Module-level job state so header + flyout share one background runner. */
let activeJobGlobal: ActiveJob | null = null;
let runningGlobal = false;
const listeners = new Set<JobListener>();

function setActiveJobGlobal(job: ActiveJob | null) {
  activeJobGlobal = job;
  for (const listener of listeners) listener(job);
}

/**
 * Non-blocking bulk runner for register toolbars.
 * Long jobs yield to the event loop and do not freeze the workspace.
 * Progress toasts keep Ops informed while work continues in the background.
 */
export function usePlatformBulkOperation() {
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(activeJobGlobal);

  useEffect(() => {
    const listener: JobListener = (job) => setActiveJob(job);
    listeners.add(listener);
    setActiveJob(activeJobGlobal);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const run = useCallback(
    async <TItem, TId extends string = string>(
      input: Omit<RunBulkOperationInput<TItem, TId>, "onProgress"> & {
        onComplete?: (summary: BulkOperationSummary<TId>) => void;
        onRetryFailed?: (
          failedIds: TId[],
          mutate: BulkMutateFn<TItem, TId>
        ) => void;
      }
    ): Promise<BulkOperationSummary<TId> | null> => {
      if (runningGlobal) {
        toast.message("A bulk update is already running. Wait for it to finish, then retry.");
        return null;
      }
      if (input.items.length === 0) {
        return null;
      }

      runningGlobal = true;
      const entityLabel = input.entityLabel?.trim() || "item";
      const entityLabelPlural =
        input.entityLabelPlural?.trim() || `${entityLabel}s`;
      setActiveJobGlobal({
        label: input.label,
        entityLabelPlural,
        startedAt: Date.now(),
      });

      try {
        const summary = await runBulkOperation({
          ...input,
          entityLabel,
          entityLabelPlural,
          onProgress: reportBulkProgress,
        });

        reportBulkSummary(summary, {
          onRetryFailed: input.onRetryFailed
            ? (failedIds) =>
                input.onRetryFailed?.(failedIds as TId[], input.mutate)
            : undefined,
        });
        input.onComplete?.(summary);
        return summary;
      } finally {
        runningGlobal = false;
        setActiveJobGlobal(null);
      }
    },
    []
  );

  return {
    run,
    isRunning: activeJob != null,
    activeJob,
  };
}
