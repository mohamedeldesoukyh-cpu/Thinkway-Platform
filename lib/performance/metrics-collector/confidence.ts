import { sanitizeMetricValue } from "@/lib/performance/metrics-collector/merge-metrics";
import type {
  CollectedMetrics,
  MetricsProviderId,
} from "@/lib/performance/metrics-collector/types";

/** Provider confidence scores (0–100). Higher = prefer for reporting. */
export const PROVIDER_CONFIDENCE: Record<MetricsProviderId, number> = {
  meta_graph_api: 100,
  tiktok_api: 100,
  youtube_data_api: 100,
  facebook_graph_api: 100,
  snapchat_api: 100,
  apify: 90,
  brightdata: 85,
  playwright: 70,
  youtube_public_metadata: 75,
  manual_import: 100,
};

export function confidenceForProvider(provider: MetricsProviderId | null): number | null {
  if (!provider) return null;
  return PROVIDER_CONFIDENCE[provider] ?? null;
}

/** Lower confidence when only comments are available (hidden IG likes/views). */
export function confidenceForCollectedMetrics(
  provider: MetricsProviderId | null,
  metrics: Partial<CollectedMetrics>
): number | null {
  const base = confidenceForProvider(provider);
  if (base == null) return null;

  const hasComments = sanitizeMetricValue(metrics.comments) != null;
  const hasViews = sanitizeMetricValue(metrics.views) != null;
  const hasLikes = sanitizeMetricValue(metrics.likes) != null;

  if (hasComments && !hasViews && !hasLikes) {
    return Math.min(base, 70);
  }

  return base;
}

export function pickWinningProvider(
  current: MetricsProviderId | null,
  currentConfidence: number | null,
  candidate: MetricsProviderId
): MetricsProviderId {
  const candidateScore = PROVIDER_CONFIDENCE[candidate] ?? 0;
  if (current == null || (currentConfidence ?? 0) < candidateScore) {
    return candidate;
  }
  return current;
}
