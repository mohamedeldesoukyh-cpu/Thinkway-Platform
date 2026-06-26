import type { EngagementRateMethod } from "@/lib/performance/engagement-rate-engine";
import { ENGAGEMENT_RATE_METHOD_LABELS } from "@/lib/performance/engagement-rate-engine";

export type ErAuditSnapshot = {
  engagement_rate: number | null;
  engagement_rate_method: EngagementRateMethod | null;
};

export type ErAuditTrigger =
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

const ER_EPSILON = 0.0001;

export function erValuesEqual(
  previous: number | null | undefined,
  next: number | null | undefined
): boolean {
  if (previous == null && next == null) return true;
  if (previous == null || next == null) return false;
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return false;
  return Math.abs(previous - next) <= ER_EPSILON;
}

export function erAuditChanged(
  previous: ErAuditSnapshot,
  next: ErAuditSnapshot
): boolean {
  const prevMethod = previous.engagement_rate_method ?? "unknown";
  const nextMethod = next.engagement_rate_method ?? "unknown";
  if (prevMethod !== nextMethod) return true;
  return !erValuesEqual(previous.engagement_rate, next.engagement_rate);
}

export function shouldWriteErAuditLog(input: {
  triggeredBy: ErAuditTrigger;
  previous: ErAuditSnapshot;
  next: ErAuditSnapshot;
  metricsChanged: boolean;
}): boolean {
  if (input.triggeredBy === "manual_restore_automatic") return true;
  if (input.triggeredBy === "manual" || input.triggeredBy === "manual_import") {
    return input.metricsChanged || erAuditChanged(input.previous, input.next);
  }
  if (!input.metricsChanged) return false;
  return erAuditChanged(input.previous, input.next);
}

export function buildErAuditMessage(input: {
  triggeredBy: ErAuditTrigger;
  previous: ErAuditSnapshot;
  next: ErAuditSnapshot;
}): string {
  const { triggeredBy, previous, next } = input;
  const newMethod = next.engagement_rate_method ?? "unknown";
  const prevMethod = previous.engagement_rate_method ?? "unknown";

  if (triggeredBy === "manual_restore_automatic") {
    if (newMethod === "views") {
      return "Automatic metrics restored. ER recalculated using Views after automatic sync.";
    }
    if (newMethod === "followers") {
      return "Automatic metrics restored. ER recalculated using Followers because views are unavailable.";
    }
    return "Automatic metrics restored.";
  }

  if (triggeredBy === "manual" || triggeredBy === "manual_import") {
    return "Manual metrics override applied.";
  }

  if (newMethod === "views" && prevMethod !== "views") {
    return "ER recalculated using Views after automatic sync.";
  }

  if (newMethod === "followers") {
    return "ER recalculated using Followers because views are unavailable.";
  }

  if (newMethod === "reach") {
    return "ER recalculated using Reach because views are unavailable.";
  }

  if (newMethod === "manual") {
    return "ER recalculated using manual override.";
  }

  const label = ENGAGEMENT_RATE_METHOD_LABELS[newMethod] ?? "Unknown";
  return `ER recalculated using ${label}.`;
}

export function metricsPayloadChanged(
  previous: Record<string, number | null | undefined>,
  incoming: Record<string, number | null | undefined>
): boolean {
  const keys = new Set([...Object.keys(previous), ...Object.keys(incoming)]);
  for (const key of keys) {
    const prev = previous[key];
    const next = incoming[key];
    if (prev == null && next == null) continue;
    if (prev == null || next == null) return true;
    if (Math.abs(prev - next) > ER_EPSILON) return true;
  }
  return false;
}
