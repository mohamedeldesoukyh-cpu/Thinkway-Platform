/**
 * Platform Bulk Operations Framework — generic runner for all operational registers.
 *
 * No domain-specific logic (Vendor IO, Assignments, Finance, etc.) belongs here.
 * Registers supply: items, getId, mutate, optional refresh, and entity labels for messaging.
 *
 * Guarantees:
 * - Partial success is never rolled back
 * - Progress callbacks for live UI
 * - Mutation failures are separated from refresh failures
 * - Event-loop yields keep the workspace responsive on large selections
 * - Refresh is locked until every selected item is processed, then runs once
 * - Processed count must equal selected count (framework execution error otherwise)
 * - Idempotent skips are first-class (already complete → skipped, not failed)
 */

import {
  beginBulkRefreshLock,
  endBulkRefreshLock,
} from "@/components/workspace/bulk-operations/bulk-refresh-gate";

export type BulkItemResult<TId extends string = string> = {
  id: TId;
  ok: boolean;
  skipped?: boolean;
  message?: string;
};

export type BulkOperationProgress = {
  label: string;
  /** Singular entity label for messaging — e.g. "Vendor IO". */
  entityLabel: string;
  /** Plural entity label — e.g. "Vendor IOs". */
  entityLabelPlural: string;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  remaining: number;
};

export type BulkOperationSummary<TId extends string = string> = {
  label: string;
  entityLabel: string;
  entityLabelPlural: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  remaining: number;
  failedIds: TId[];
  succeededIds: TId[];
  skippedIds: TId[];
  lastError?: string;
  /** Mutation phase finished without throwing. */
  mutationPhaseOk: boolean;
  /**
   * True when processed (succeeded+failed+skipped) !== selected total.
   * Must never be silently ignored by consumers.
   */
  executionIncomplete: boolean;
  /** Refresh phase outcome (null if refresh was not attempted). */
  refreshPhase: "ok" | "failed" | "skipped" | null;
  refreshError?: string;
};

export type BulkMutateFn<TItem, TId extends string = string> = (
  item: TItem
) => Promise<{ ok: boolean; skipped?: boolean; message?: string; id?: TId }>;

export type RunBulkOperationInput<TItem, TId extends string = string> = {
  label: string;
  items: TItem[];
  getId: (item: TItem) => TId;
  mutate: BulkMutateFn<TItem, TId>;
  entityLabel?: string;
  entityLabelPlural?: string;
  onProgress?: (progress: BulkOperationProgress) => void;
  /** Optional refresh after at least one success. Errors are captured, never thrown. */
  refresh?: () => void | Promise<void>;
  /**
   * Yield to the event loop every N items so the UI stays interactive.
   * Default: 1 (yield after every item). Set higher only for tiny/fast local work.
   */
  yieldEvery?: number;
};

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
      window.setTimeout(resolve, 0);
      return;
    }
    setTimeout(resolve, 0);
  });
}

/**
 * Run a bulk operation sequentially with progress callbacks and UI yields.
 * Owns the full lifecycle: lock refresh → execute all → unlock → refresh once.
 * Partial success is preserved — failures never undo earlier successes.
 */
export async function runBulkOperation<TItem, TId extends string = string>(
  input: RunBulkOperationInput<TItem, TId>
): Promise<BulkOperationSummary<TId>> {
  const {
    label,
    items,
    getId,
    mutate,
    onProgress,
    refresh,
    yieldEvery = 1,
  } = input;
  const entityLabel = input.entityLabel?.trim() || "item";
  const entityLabelPlural =
    input.entityLabelPlural?.trim() || `${entityLabel}s`;
  const total = items.length;
  const succeededIds: TId[] = [];
  const failedIds: TId[] = [];
  const skippedIds: TId[] = [];
  let lastError: string | undefined;
  let completed = 0;

  const emit = () => {
    onProgress?.({
      label,
      entityLabel,
      entityLabelPlural,
      total,
      completed,
      succeeded: succeededIds.length,
      failed: failedIds.length,
      skipped: skippedIds.length,
      remaining: Math.max(0, total - completed),
    });
  };

  beginBulkRefreshLock();
  emit();

  try {
    for (const item of items) {
      const id = getId(item);
      try {
        const result = await mutate(item);
        const resultId = (result.id ?? id) as TId;
        if (result.skipped) {
          skippedIds.push(resultId);
        } else if (result.ok) {
          succeededIds.push(resultId);
        } else {
          failedIds.push(resultId);
          lastError = result.message ?? lastError;
        }
      } catch (error) {
        failedIds.push(id);
        lastError =
          error instanceof Error ? error.message : "Unexpected update error.";
      }
      completed += 1;
      emit();

      if (yieldEvery > 0 && completed % yieldEvery === 0 && completed < total) {
        await yieldToBrowser();
      }
    }
  } finally {
    // Unlock before the single post-run refresh so that refresh is allowed.
    endBulkRefreshLock();
  }

  const processed =
    succeededIds.length + failedIds.length + skippedIds.length;
  const executionIncomplete = processed !== total;
  if (executionIncomplete) {
    lastError =
      lastError ??
      `Bulk execution incomplete: selected ${total}, processed ${processed}.`;
  }

  let refreshPhase: BulkOperationSummary<TId>["refreshPhase"] = null;
  let refreshError: string | undefined;

  // One refresh after every selected item has been attempted.
  if ((succeededIds.length > 0 || skippedIds.length > 0) && refresh) {
    try {
      await Promise.resolve(refresh());
      refreshPhase = "ok";
    } catch (error) {
      refreshPhase = "failed";
      refreshError =
        error instanceof Error
          ? error.message
          : `Unable to refresh the ${entityLabelPlural} list.`;
    }
  } else if (succeededIds.length === 0 && skippedIds.length === 0) {
    refreshPhase = "skipped";
  }

  return {
    label,
    entityLabel,
    entityLabelPlural,
    total,
    succeeded: succeededIds.length,
    failed: failedIds.length,
    skipped: skippedIds.length,
    remaining: 0,
    failedIds,
    succeededIds,
    skippedIds,
    lastError,
    mutationPhaseOk: !executionIncomplete,
    executionIncomplete,
    refreshPhase,
    refreshError,
  };
}

function noun(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Business-facing summary for Operations — never technical shorthand like "32 completed".
 */
export function formatBulkOperationSummary(
  summary: BulkOperationSummary
): { title: string; description: string; tone: "success" | "warning" | "error" } {
  const {
    succeeded,
    failed,
    skipped,
    total,
    label,
    entityLabel,
    entityLabelPlural,
    refreshPhase,
    refreshError,
    lastError,
    executionIncomplete,
  } = summary;

  if (executionIncomplete) {
    return {
      title: `Bulk execution stopped early`,
      description:
        lastError ??
        `Selected ${total}, but not every record was processed. Retry Failed — completed work was kept.`,
      tone: "error",
    };
  }

  if (succeeded === 0 && failed === 0 && skipped === total) {
    return {
      title: `No ${entityLabelPlural} needed updates`,
      description: `${skipped} ${noun(skipped, entityLabel, entityLabelPlural)} were already complete or not applicable for “${label}”.`,
      tone: "warning",
    };
  }

  if (succeeded === 0 && failed > 0) {
    return {
      title: `${failed} ${noun(failed, entityLabel, entityLabelPlural)} could not be updated`,
      description:
        lastError ??
        `The “${label}” operation failed. No records were changed. Retry Failed to try again.`,
      tone: "error",
    };
  }

  if (failed === 0 && refreshPhase === "failed") {
    return {
      title: `${succeeded} ${noun(succeeded, entityLabel, entityLabelPlural)} were updated successfully`,
      description:
        refreshError ??
        `Updates were saved, but the ${entityLabelPlural} list could not refresh. Your work is complete — reload if the table looks stale.`,
      tone: "warning",
    };
  }

  if (failed === 0) {
    const already =
      skipped > 0
        ? ` Already completed: ${skipped}.`
        : "";
    return {
      title: `${succeeded} ${noun(succeeded, entityLabel, entityLabelPlural)} were updated successfully`,
      description:
        skipped > 0 && succeeded === 0
          ? `${skipped} ${noun(skipped, entityLabel, entityLabelPlural)} were already complete. No failures.`
          : `Selected ${total}.${already} No failures.`,
      tone: "success",
    };
  }

  return {
    title: `${succeeded} ${noun(succeeded, entityLabel, entityLabelPlural)} updated · ${failed} failed`,
    description: [
      `Selected ${total}. Successful ${succeeded}. Failed ${failed}. Already completed ${skipped}.`,
      lastError ? `Last error: ${lastError}.` : null,
      refreshPhase === "failed"
        ? refreshError ??
          `Display refresh failed while updates were successfully saved.`
        : "Successful records are kept. Use Retry Failed for the rest.",
    ]
      .filter(Boolean)
      .join(" "),
    tone: "warning",
  };
}
