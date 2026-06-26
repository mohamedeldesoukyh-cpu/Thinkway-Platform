import type { ReachSource } from "@/lib/performance/reach-forecast-engine";
import { REACH_SOURCE_LABELS } from "@/lib/performance/reach-forecast-engine";

export type ReachAuditSnapshot = {
  reach: number | null;
  reach_source: ReachSource | null;
  forecast_reach: number | null;
};

export type ReachAuditTrigger =
  | "auto_create"
  | "manual_refresh"
  | "bulk_refresh"
  | "scheduled_cron"
  | "scheduled_worker"
  | "manual_import"
  | "manual_restore_automatic"
  | "manual"
  | "metrics_collected"
  | string;

const REACH_EPSILON = 0.5;

export function reachValuesEqual(
  previous: number | null | undefined,
  next: number | null | undefined
): boolean {
  if (previous == null && next == null) return true;
  if (previous == null || next == null) return false;
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return false;
  return Math.abs(previous - next) <= REACH_EPSILON;
}

export function reachAuditChanged(previous: ReachAuditSnapshot, next: ReachAuditSnapshot): boolean {
  const prevSource = previous.reach_source ?? null;
  const nextSource = next.reach_source ?? null;
  if (prevSource !== nextSource) return true;
  return !reachValuesEqual(previous.reach, next.reach);
}

export function shouldWriteReachAuditLog(input: {
  triggeredBy: ReachAuditTrigger;
  previous: ReachAuditSnapshot;
  next: ReachAuditSnapshot;
  metricsChanged: boolean;
}): boolean {
  if (input.triggeredBy === "manual_restore_automatic") return true;
  if (input.triggeredBy === "manual" || input.triggeredBy === "manual_import") {
    return input.metricsChanged || reachAuditChanged(input.previous, input.next);
  }
  if (!input.metricsChanged && !reachAuditChanged(input.previous, input.next)) return false;
  return reachAuditChanged(input.previous, input.next);
}

export function buildReachAuditMessage(input: {
  triggeredBy: ReachAuditTrigger;
  previous: ReachAuditSnapshot;
  next: ReachAuditSnapshot;
}): string {
  const { triggeredBy, previous, next } = input;
  const prevSource = previous.reach_source;
  const nextSource = next.reach_source;

  if (triggeredBy === "manual" || triggeredBy === "manual_import") {
    return "Manual reach override applied.";
  }

  if (prevSource === "forecast" && nextSource === "actual") {
    return "Actual provider reach replaced forecasted reach.";
  }

  if (nextSource === "forecast" && prevSource !== "forecast") {
    return "Reach forecasted from creator followers because provider reach was unavailable.";
  }

  if (nextSource) {
    const label = REACH_SOURCE_LABELS[nextSource] ?? nextSource;
    return `Reach source updated to ${label}.`;
  }

  return "Reach values updated.";
}
