import type { CollectedMetrics } from "@/lib/performance/metrics-collector/types";
import { mergeCollectedMetrics } from "@/lib/performance/metrics-collector/merge-metrics";

const METRIC_ALIASES: Record<string, keyof CollectedMetrics> = {
  views: "views",
  view: "views",
  video_views: "views",
  reach: "reach",
  impressions: "impressions",
  impr: "impressions",
  likes: "likes",
  like: "likes",
  comments: "comments",
  comment: "comments",
  shares: "shares",
  share: "shares",
  saves: "saves",
  save: "saves",
  engagements: "engagements",
  engagement: "engagements",
  engagement_rate: "engagement_rate",
  er: "engagement_rate",
  er_percent: "engagement_rate",
  plays: "plays",
  clicks: "clicks",
};

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const cleaned = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseMetricsImportRow(
  row: Record<string, string>
): Partial<CollectedMetrics> {
  const metrics: Partial<CollectedMetrics> = {};

  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = METRIC_ALIASES[rawKey.trim().toLowerCase()];
    if (!key) continue;
    const parsed = parseNumber(rawValue);
    if (parsed != null) metrics[key] = parsed;
  }

  return mergeCollectedMetrics({}, metrics);
}

export function normalizeImportHeaders(headers: string[]): string[] {
  return headers.map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
}
