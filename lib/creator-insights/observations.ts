import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import { contentFormatFamily } from "./content-format";
import type {
  ContentFormatFamily,
  CreatorInsightDataLevel,
  CreatorInsightMetricKey,
  NullableMetrics,
} from "./types";
import { STALE_SYNC_MS } from "./types";

export type CreatorPublicationObservation = NullableMetrics & {
  id: string;
  influencerId: string;
  campaignHeaderId: string | null;
  assignmentDeliverableId: string | null;
  assignmentPostScheduleId: string | null;
  platform: string;
  publicationType: string;
  formatFamily: ContentFormatFamily;
  contentUrl: string | null;
  publishedAt: string | null;
  status: string | null;
  updatedAt: string | null;
  source: "thinkway_publication" | "social_content" | "merged";
  matchStatus: "matched" | "unmatched" | "uncertain" | null;
};

export type CreatorConnectionSnapshot = {
  provider: string;
  displayName: string;
  status: string;
  lastSyncedAt: string | null;
};

const EMPTY_METRICS: NullableMetrics = {
  views: null,
  reach: null,
  impressions: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  engagementRate: null,
  followers: null,
};

export function emptyMetrics(): NullableMetrics {
  return { ...EMPTY_METRICS };
}

export function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Prefer a real value. Never treat missing as zero. */
export function preferPresent(
  preferred: number | null | undefined,
  fallback: number | null | undefined
): number | null {
  if (preferred != null && Number.isFinite(preferred)) return preferred;
  if (fallback != null && Number.isFinite(fallback)) return fallback;
  return null;
}

export function mergeNullableMetrics(
  primary: Partial<NullableMetrics> | null | undefined,
  fallback: Partial<NullableMetrics> | null | undefined
): NullableMetrics {
  return {
    views: preferPresent(primary?.views ?? null, fallback?.views ?? null),
    reach: preferPresent(primary?.reach ?? null, fallback?.reach ?? null),
    impressions: preferPresent(primary?.impressions ?? null, fallback?.impressions ?? null),
    likes: preferPresent(primary?.likes ?? null, fallback?.likes ?? null),
    comments: preferPresent(primary?.comments ?? null, fallback?.comments ?? null),
    shares: preferPresent(primary?.shares ?? null, fallback?.shares ?? null),
    saves: preferPresent(primary?.saves ?? null, fallback?.saves ?? null),
    engagementRate: preferPresent(
      primary?.engagementRate ?? null,
      fallback?.engagementRate ?? null
    ),
    followers: preferPresent(primary?.followers ?? null, fallback?.followers ?? null),
  };
}

export function hasAnyMetric(metrics: Partial<NullableMetrics> | null | undefined): boolean {
  if (!metrics) return false;
  return (
    metrics.views != null ||
    metrics.reach != null ||
    metrics.impressions != null ||
    metrics.likes != null ||
    metrics.comments != null ||
    metrics.shares != null ||
    metrics.saves != null ||
    metrics.engagementRate != null
  );
}

export function metricValue(
  metrics: Partial<NullableMetrics>,
  key: CreatorInsightMetricKey
): number | null {
  const value = metrics[key];
  return value != null && Number.isFinite(value) ? value : null;
}

const METRIC_PRIORITY: CreatorInsightMetricKey[] = [
  "engagementRate",
  "views",
  "reach",
  "impressions",
];

export function chooseComparableMetric(
  items: ReadonlyArray<Partial<NullableMetrics>>,
  minPresent: number
): CreatorInsightMetricKey | null {
  for (const key of METRIC_PRIORITY) {
    const count = items.filter((item) => metricValue(item, key) != null).length;
    if (count >= minPresent) return key;
  }
  return null;
}

export function observationFromPublication(row: {
  id: string;
  influencerId: string;
  campaignHeaderId: string | null;
  assignmentDeliverableId: string | null;
  assignmentPostScheduleId: string | null;
  platform: string | null;
  publicationType: string | null;
  contentUrl: string | null;
  publicationDate: string | null;
  status: string | null;
  updatedAt: string | null;
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagementRate: number | null;
}): CreatorPublicationObservation {
  const publicationType = row.publicationType ?? "other";
  return {
    id: row.id,
    influencerId: row.influencerId,
    campaignHeaderId: row.campaignHeaderId,
    assignmentDeliverableId: row.assignmentDeliverableId,
    assignmentPostScheduleId: row.assignmentPostScheduleId,
    platform: canonicalPlatformKey(row.platform) || "other",
    publicationType,
    formatFamily: contentFormatFamily(publicationType),
    contentUrl: row.contentUrl,
    publishedAt: row.publicationDate,
    status: row.status,
    updatedAt: row.updatedAt,
    source: "thinkway_publication",
    matchStatus: null,
    ...mergeNullableMetrics(
      {
        views: row.views,
        reach: row.reach,
        impressions: row.impressions,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        saves: row.saves,
        engagementRate: row.engagementRate,
        followers: null,
      },
      emptyMetrics()
    ),
  };
}

export function overlayMatchedSocialInsight(
  observation: CreatorPublicationObservation,
  insight: Partial<NullableMetrics> & {
    publishedAt?: string | null;
    contentType?: string | null;
    capturedAt?: string | null;
  }
): CreatorPublicationObservation {
  const merged = mergeNullableMetrics(insight, observation);
  return {
    ...observation,
    ...merged,
    source: hasAnyMetric(insight) ? "merged" : observation.source,
    matchStatus: "matched",
    publishedAt: insight.publishedAt ?? observation.publishedAt,
    formatFamily: contentFormatFamily(observation.publicationType, insight.contentType),
    updatedAt: insight.capturedAt ?? observation.updatedAt,
  };
}

export function observationFromUnmatchedSocial(row: {
  id: string;
  influencerId: string;
  provider: string;
  contentType: string | null;
  canonicalUrl: string | null;
  publishedAt: string | null;
  capturedAt: string | null;
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagementRate: number | null;
  followers: number | null;
}): CreatorPublicationObservation {
  const publicationType = row.contentType ?? "other";
  return {
    id: row.id,
    influencerId: row.influencerId,
    campaignHeaderId: null,
    assignmentDeliverableId: null,
    assignmentPostScheduleId: null,
    platform: canonicalPlatformKey(row.provider) || "other",
    publicationType,
    formatFamily: contentFormatFamily(publicationType),
    contentUrl: row.canonicalUrl,
    publishedAt: row.publishedAt,
    status: "published",
    updatedAt: row.capturedAt,
    source: "social_content",
    matchStatus: "unmatched",
    views: row.views,
    reach: row.reach,
    impressions: row.impressions,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    engagementRate: row.engagementRate,
    followers: row.followers,
  };
}

export function resolveDataLevel(input: {
  hasOperationalHistory: boolean;
  observations: readonly CreatorPublicationObservation[];
  connections: readonly CreatorConnectionSnapshot[];
}): CreatorInsightDataLevel {
  const hasFreshSocialMetrics = input.observations.some(
    (row) =>
      (row.source === "merged" || row.source === "social_content") && hasAnyMetric(row)
  );
  const connected = input.connections.some(
    (row) => row.status === "connected" || row.status === "syncing"
  );
  if (connected && hasFreshSocialMetrics) return 2;
  if (input.observations.some((row) => hasAnyMetric(row))) return 1;
  return input.hasOperationalHistory ? 0 : 0;
}

export function dataAvailabilityLabel(level: CreatorInsightDataLevel): string {
  if (level === 2) return "Includes connected platform data";
  if (level === 1) return "Thinkway publication metrics";
  return "Thinkway campaign data";
}

export function isConnectionStale(
  connections: readonly CreatorConnectionSnapshot[],
  now = Date.now()
): boolean {
  const active = connections.filter(
    (row) => row.status === "connected" || row.status === "syncing" || row.status === "needs_attention"
  );
  if (active.length === 0) return false;
  return active.every((row) => {
    if (row.status === "needs_attention") return true;
    if (!row.lastSyncedAt) return true;
    const then = new Date(row.lastSyncedAt).getTime();
    if (!Number.isFinite(then)) return true;
    return now - then > STALE_SYNC_MS;
  });
}

export function latestSyncAt(connections: readonly CreatorConnectionSnapshot[]): string | null {
  let latest: string | null = null;
  for (const row of connections) {
    if (!row.lastSyncedAt) continue;
    if (!latest || row.lastSyncedAt > latest) latest = row.lastSyncedAt;
  }
  return latest;
}

export function latestSourceTimestamp(
  observations: readonly CreatorPublicationObservation[]
): string | null {
  let latest: string | null = null;
  for (const row of observations) {
    const stamp = row.updatedAt ?? row.publishedAt;
    if (!stamp) continue;
    if (!latest || stamp > latest) latest = stamp;
  }
  return latest;
}

export function sortNewestFirst(
  observations: readonly CreatorPublicationObservation[]
): CreatorPublicationObservation[] {
  return [...observations].sort((a, b) => {
    const aStamp = a.publishedAt ?? a.updatedAt ?? "";
    const bStamp = b.publishedAt ?? b.updatedAt ?? "";
    return bStamp.localeCompare(aStamp);
  });
}
