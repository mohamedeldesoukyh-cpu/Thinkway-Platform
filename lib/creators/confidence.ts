import type { MetricConfidenceLevel, MetricWithConfidence } from "@/lib/creators/types";

export function metricWithConfidence(
  value: number | null | undefined,
  confidence: MetricConfidenceLevel
): MetricWithConfidence {
  return {
    value: value ?? null,
    confidence,
  };
}

export function resolveInternalMetricConfidence(input: {
  metrics_source?: string | null;
  sync_status?: string | null;
  is_manual_override?: boolean;
  has_value: boolean;
}): MetricConfidenceLevel {
  if (input.is_manual_override && input.has_value) return "verified";
  if (input.metrics_source === "synced" && input.sync_status === "synced") {
    return "oauth_verified";
  }
  if (input.has_value) return "inferred";
  return "estimated";
}

export function resolveDiscoveryMetricConfidence(input: {
  stage?: string;
  has_value: boolean;
  from_ai?: boolean;
}): MetricConfidenceLevel {
  if (!input.has_value) return "estimated";
  if (input.stage === "verified") return "verified";
  if (input.stage === "ai_scored" || input.stage === "metrics_enriched") {
    return input.from_ai ? "inferred" : "verified";
  }
  return "inferred";
}

export function averageSourceConfidence(metrics: MetricWithConfidence[]): number {
  const weights: Record<MetricConfidenceLevel, number> = {
    estimated: 35,
    inferred: 60,
    verified: 85,
    oauth_verified: 95,
  };
  if (metrics.length === 0) return 40;
  const sum = metrics.reduce((acc, m) => acc + weights[m.confidence], 0);
  return Math.round(sum / metrics.length);
}
