import type { ComponentStatus } from "../types";
import type { HealthCheckResult, LatencyThresholds } from "../types";

export function latencyReason(
  latencyMs: number | null,
  thresholds: LatencyThresholds,
  offline?: boolean,
  offlineMessage?: string,
): { status: ComponentStatus; reason: string } {
  if (offline) {
    return {
      status: "offline",
      reason: offlineMessage ?? "Component unreachable.",
    };
  }
  if (latencyMs == null) {
    return { status: "unknown", reason: "Latency not measured." };
  }
  if (latencyMs >= thresholds.criticalMs) {
    return {
      status: "critical",
      reason: `Latency exceeded critical threshold (≥${thresholds.criticalMs} ms).`,
    };
  }
  if (latencyMs >= thresholds.warningMs) {
    return {
      status: "warning",
      reason: `Latency exceeded warning threshold (≥${thresholds.warningMs} ms).`,
    };
  }
  return {
    status: "healthy",
    reason: `Latency within healthy range (<${thresholds.warningMs} ms).`,
  };
}

export function suggestedActionForStatus(
  status: ComponentStatus,
  componentId: string,
): string {
  switch (status) {
    case "healthy":
      return "No action required.";
    case "expected":
      return `Expected in local development for ${componentId}; no production incident.`;
    case "warning":
      return `Investigate ${componentId} latency/config; check recent deploys and dependency load.`;
    case "critical":
      return `Treat as incident: verify ${componentId} connectivity, credentials, and recent errors.`;
    case "offline":
      return `Restore ${componentId} connectivity immediately; confirm env vars and network path.`;
    case "unknown":
    default:
      return `Configure or instrument ${componentId} so health can be determined.`;
  }
}

export function defaultLogsUrl(componentId: string): string {
  return `/operations?tab=logs&source=${encodeURIComponent(componentId)}`;
}

export function withDiagnostics(
  result: HealthCheckResult,
  extras: {
    reason: string;
    suggestedAction?: string;
    thresholds?: LatencyThresholds;
    technicalDetails?: Record<string, unknown>;
    logsUrl?: string;
  },
): HealthCheckResult {
  return {
    ...result,
    reason: extras.reason,
    suggestedAction:
      extras.suggestedAction ??
      suggestedActionForStatus(result.status, result.id),
    thresholds: extras.thresholds,
    technicalDetails: extras.technicalDetails,
    logsUrl: extras.logsUrl ?? defaultLogsUrl(result.id),
  };
}

/** Redis latency bands (ms) — deployment verification defaults. */
export const REDIS_LATENCY_THRESHOLDS: LatencyThresholds = {
  healthyMaxMs: 100,
  warningMs: 100,
  criticalMs: 300,
};

/** Supabase DB latency bands (ms). */
export const SUPABASE_LATENCY_THRESHOLDS: LatencyThresholds = {
  healthyMaxMs: 400,
  warningMs: 400,
  criticalMs: 1500,
};

/** Storage API latency bands (ms). */
export const STORAGE_LATENCY_THRESHOLDS: LatencyThresholds = {
  healthyMaxMs: 800,
  warningMs: 800,
  criticalMs: 2500,
};
