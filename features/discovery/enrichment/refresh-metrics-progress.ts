/**
 * Maps creator refresh / enrichment status → compact circle progress.
 *
 * Poll payloads expose sync stages (pending → queued → collecting → completed/failed)
 * but not a numeric percent. Stage → % mapping (documented for UI consistency):
 *   pending/start  → 8
 *   queued         → 18
 *   collecting/run → 62
 *   terminal       → 100
 */

import {
  isEnrichmentInProgress,
  type CreatorEnrichmentStatus,
} from "./status";

export type RefreshMetricsProgressTone = "progress" | "done" | "failed" | "partial";

export type RefreshMetricsProgressView = {
  percent: number;
  tone: RefreshMetricsProgressTone;
  /** Short label for tooltip / aria (Done / Failed / Partial / Collecting…). */
  label: string;
};

/** How long terminal outcome stays visible after a refresh finishes. */
export const REFRESH_METRICS_OUTCOME_LINGER_MS = 5_000;

const TONE_STROKE: Record<RefreshMetricsProgressTone, string> = {
  progress: "#0057FF",
  done: "#1D9E75",
  failed: "#C82121",
  partial: "#D97706",
};

const TONE_TRACK: Record<RefreshMetricsProgressTone, string> = {
  progress: "rgba(0, 87, 255, 0.18)",
  done: "rgba(29, 158, 117, 0.22)",
  failed: "rgba(200, 33, 33, 0.2)",
  partial: "rgba(217, 119, 6, 0.22)",
};

export function refreshMetricsStrokeColor(tone: RefreshMetricsProgressTone): string {
  return TONE_STROKE[tone];
}

export function refreshMetricsTrackColor(tone: RefreshMetricsProgressTone): string {
  return TONE_TRACK[tone];
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Derive circle state from enrichment status.
 * Returns null when idle (never / enriched / skipped / awaiting) — callers decide
 * whether to keep a terminal linger after a just-finished refresh.
 */
export function enrichmentStatusToRefreshProgress(
  status: CreatorEnrichmentStatus,
  options?: { isPending?: boolean; includeTerminal?: boolean }
): RefreshMetricsProgressView | null {
  if (options?.isPending && !isEnrichmentInProgress(status)) {
    return { percent: 8, tone: "progress", label: "Starting" };
  }

  switch (status) {
    case "queued":
      return { percent: 18, tone: "progress", label: "Queued" };
    case "running":
      return { percent: 62, tone: "progress", label: "Collecting" };
    case "enriched":
    case "skipped":
      return options?.includeTerminal
        ? { percent: 100, tone: "done", label: "Done" }
        : null;
    case "partial":
      return options?.includeTerminal
        ? { percent: 100, tone: "partial", label: "Partial" }
        : null;
    case "failed":
      return options?.includeTerminal
        ? { percent: 100, tone: "failed", label: "Failed" }
        : null;
    case "awaiting_profile_details":
    case "never":
    default:
      return null;
  }
}

/** Batch banner: completed/total with failed → partial or failed tone when done. */
export function batchRefreshProgress(input: {
  total: number;
  completed: number;
  failed: number;
}): RefreshMetricsProgressView {
  const total = Math.max(0, input.total);
  const completed = Math.max(0, Math.min(input.completed, total || input.completed));
  const failed = Math.max(0, input.failed);
  const done = total > 0 && completed >= total;
  const percent =
    total <= 0 ? 0 : clampPercent((completed / total) * 100);

  if (!done) {
    return {
      percent: Math.max(percent, completed === 0 ? 8 : percent),
      tone: "progress",
      label: `Collecting ${completed} of ${total}`,
    };
  }

  if (failed > 0 && failed >= total) {
    return { percent: 100, tone: "failed", label: "Failed" };
  }
  if (failed > 0) {
    return { percent: 100, tone: "partial", label: "Partial" };
  }
  return { percent: 100, tone: "done", label: "Done" };
}

export function isTerminalEnrichmentStatus(status: CreatorEnrichmentStatus): boolean {
  return (
    status === "enriched" ||
    status === "failed" ||
    status === "partial" ||
    status === "skipped"
  );
}
