import { getSocialProvider } from "@/lib/creator-social/providers/registry";
import type { SocialProviderId } from "@/lib/creator-social/ids";

import { baselineMeans, chooseBaselineWindow, sameFormatObservations } from "./baseline";
import { contentFormatFamily, contentFormatLabel, contentFormatSingular } from "./content-format";
import {
  chooseComparableMetric,
  metricValue,
  sortNewestFirst,
  type CreatorConnectionSnapshot,
  type CreatorPublicationObservation,
} from "./observations";
import {
  confidenceFromSampleAndDelta,
  formatMetricNumber,
  meanOfPresent,
  medianOfPresent,
  percentChange,
  presentCount,
  trendFromDelta,
} from "./stats";
import type {
  ContentFormatFamily,
  CreatorInsightMetricKey,
  DetectedCreatorInsight,
  UpcomingCreatorUnit,
  UnitCompactInsight,
} from "./types";
import {
  MIN_ENGAGEMENT_SAMPLE,
  MIN_FORMAT_EACH,
  MIN_RELATIVE_DELTA,
  MIN_TIMING_SAMPLE,
  MIN_TREND_EACH_SIDE,
  MIN_UNIT_BASELINE,
} from "./types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function evidenceMetric(
  label: string,
  value: number | null,
  metricKey: CreatorInsightMetricKey
): { label: string; value: string } | null {
  if (value == null) return null;
  return { label, value: formatMetricNumber(value, metricKey) };
}

export function detectPerformanceTrend(
  observations: readonly CreatorPublicationObservation[]
): DetectedCreatorInsight | null {
  const ordered = sortNewestFirst(observations);
  const window = chooseBaselineWindow(ordered);
  if (!window) return null;
  const metricKey = chooseComparableMetric(
    [...window.recent, ...window.prior],
    window.windowSize * 2
  );
  if (!metricKey) return null;
  const { recentMean, priorMean, sampleSize } = baselineMeans(window, metricKey);
  const delta = percentChange(recentMean, priorMean);
  const trend = trendFromDelta(delta);
  if (!trend || trend === "flat") return null;
  const confidence = confidenceFromSampleAndDelta(sampleSize, delta == null ? null : Math.abs(delta));
  if (!confidence) return null;
  const recentEvidence = evidenceMetric(
    `Recent ${window.windowSize} ${metricKey}`,
    recentMean,
    metricKey
  );
  const priorEvidence = evidenceMetric(
    `Previous ${window.windowSize} ${metricKey}`,
    priorMean,
    metricKey
  );
  if (!recentEvidence || !priorEvidence) return null;
  return {
    type: "performance_trend",
    confidence,
    metricKey,
    sampleSize,
    campaignHeaderId: null,
    assignmentDeliverableId: null,
    formatFamily: null,
    platform: null,
    priority: 90,
    facts: {
      recentMean,
      priorMean,
      sampleSize,
      windowSize: window.windowSize,
      deltaPct: delta == null ? null : Math.round(delta * 1000) / 10,
      trend,
      metricKey,
    },
    evidence: [recentEvidence, priorEvidence, { label: "Sample", value: String(sampleSize) }],
  };
}

export function detectStrongContentType(
  observations: readonly CreatorPublicationObservation[]
): DetectedCreatorInsight | null {
  const ordered = sortNewestFirst(observations);
  const byFamily = new Map<ContentFormatFamily, CreatorPublicationObservation[]>();
  for (const row of ordered) {
    if (row.formatFamily === "other") continue;
    const list = byFamily.get(row.formatFamily) ?? [];
    list.push(row);
    byFamily.set(row.formatFamily, list);
  }
  const qualified: Array<{
    family: ContentFormatFamily;
    metricKey: CreatorInsightMetricKey;
    mean: number;
    sampleSize: number;
  }> = [];
  for (const [family, rows] of byFamily) {
    const metricKey = chooseComparableMetric(rows, MIN_FORMAT_EACH);
    if (!metricKey) continue;
    const values = rows.map((row) => metricValue(row, metricKey));
    if (presentCount(values) < MIN_FORMAT_EACH) continue;
    const mean = meanOfPresent(values);
    if (mean == null) continue;
    qualified.push({ family, metricKey, mean, sampleSize: presentCount(values) });
  }
  if (qualified.length < 2) return null;
  const metricCounts = new Map<CreatorInsightMetricKey, number>();
  for (const row of qualified) {
    metricCounts.set(row.metricKey, (metricCounts.get(row.metricKey) ?? 0) + 1);
  }
  const sharedMetric =
    [...metricCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const comparable = sharedMetric
    ? qualified.filter((row) => row.metricKey === sharedMetric)
    : qualified;
  if (comparable.length < 2) return null;
  const ranked = [...comparable].sort((a, b) => b.mean - a.mean);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || !second) return null;
  const delta = percentChange(top.mean, second.mean);
  if (delta == null || delta < MIN_RELATIVE_DELTA) return null;
  const sampleSize = top.sampleSize + second.sampleSize;
  const confidence = confidenceFromSampleAndDelta(sampleSize, delta);
  if (!confidence) return null;
  const metricKey = top.metricKey;
  const topEvidence = evidenceMetric(
    `${contentFormatLabel(top.family)} median ${metricKey}`,
    medianOfPresent(
      sameFormatObservations(ordered, top.family).map((row) => metricValue(row, metricKey))
    ),
    metricKey
  );
  const secondEvidence = evidenceMetric(
    `${contentFormatLabel(second.family)} median ${metricKey}`,
    medianOfPresent(
      sameFormatObservations(ordered, second.family).map((row) => metricValue(row, metricKey))
    ),
    metricKey
  );
  if (!topEvidence || !secondEvidence) return null;
  return {
    type: "strong_content_type",
    confidence,
    metricKey,
    sampleSize,
    campaignHeaderId: null,
    assignmentDeliverableId: null,
    formatFamily: top.family,
    platform: null,
    priority: 80,
    facts: {
      strongestFamily: top.family,
      comparisonFamily: second.family,
      strongestMean: top.mean,
      comparisonMean: second.mean,
      sampleSize,
      strongestSample: top.sampleSize,
      comparisonSample: second.sampleSize,
      deltaPct: Math.round(delta * 1000) / 10,
      metricKey,
    },
    evidence: [
      { label: `${contentFormatLabel(top.family)} sample`, value: String(top.sampleSize) },
      topEvidence,
      { label: `${contentFormatLabel(second.family)} sample`, value: String(second.sampleSize) },
      secondEvidence,
    ],
  };
}

export function detectEngagementOpportunity(
  observations: readonly CreatorPublicationObservation[]
): DetectedCreatorInsight | null {
  const ordered = sortNewestFirst(observations);
  const window = chooseBaselineWindow(ordered);
  if (!window) return null;
  const withBoth = ordered.filter(
    (row) => metricValue(row, "views") != null && metricValue(row, "comments") != null
  );
  if (withBoth.length < MIN_ENGAGEMENT_SAMPLE) return null;
  const viewsWindow = chooseBaselineWindow(withBoth);
  if (!viewsWindow) return null;
  const views = baselineMeans(viewsWindow, "views");
  const comments = baselineMeans(viewsWindow, "comments");
  const viewsDelta = percentChange(views.recentMean, views.priorMean);
  const commentsDelta = percentChange(comments.recentMean, comments.priorMean);
  const viewsTrend = trendFromDelta(viewsDelta);
  if (viewsTrend !== "up") return null;
  if (commentsDelta == null || commentsDelta > -MIN_RELATIVE_DELTA) return null;
  const sampleSize = views.sampleSize;
  if (sampleSize < MIN_ENGAGEMENT_SAMPLE) return null;
  const confidence = confidenceFromSampleAndDelta(
    sampleSize,
    Math.min(Math.abs(viewsDelta ?? 0), Math.abs(commentsDelta))
  );
  if (!confidence) return null;
  const viewsRecent = evidenceMetric("Recent views", views.recentMean, "views");
  const commentsRecent = evidenceMetric("Recent comments", comments.recentMean, "comments");
  const commentsPrior = evidenceMetric("Previous comments", comments.priorMean, "comments");
  if (!viewsRecent || !commentsRecent || !commentsPrior) return null;
  return {
    type: "engagement_opportunity",
    confidence,
    metricKey: "comments",
    sampleSize,
    campaignHeaderId: null,
    assignmentDeliverableId: null,
    formatFamily: null,
    platform: null,
    priority: 70,
    facts: {
      recentViews: views.recentMean,
      priorViews: views.priorMean,
      recentComments: comments.recentMean,
      priorComments: comments.priorMean,
      viewsDeltaPct: viewsDelta == null ? null : Math.round(viewsDelta * 1000) / 10,
      commentsDeltaPct: Math.round(commentsDelta * 1000) / 10,
      sampleSize,
    },
    evidence: [
      viewsRecent,
      commentsRecent,
      commentsPrior,
      { label: "Sample", value: String(sampleSize) },
    ],
  };
}

function weekdayName(iso: string): string | null {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return WEEKDAYS[date.getUTCDay()] ?? null;
}

export function detectPublicationTiming(
  observations: readonly CreatorPublicationObservation[]
): DetectedCreatorInsight | null {
  const dated = sortNewestFirst(observations).filter((row) => row.publishedAt);
  const metricKey = chooseComparableMetric(dated, MIN_TIMING_SAMPLE);
  if (!metricKey) return null;
  const usable = dated.filter((row) => metricValue(row, metricKey) != null);
  if (usable.length < MIN_TIMING_SAMPLE) return null;
  const byDay = new Map<string, number[]>();
  for (const row of usable) {
    const day = weekdayName(row.publishedAt!);
    const value = metricValue(row, metricKey);
    if (!day || value == null) continue;
    const list = byDay.get(day) ?? [];
    list.push(value);
    byDay.set(day, list);
  }
  const overall = meanOfPresent(usable.map((row) => metricValue(row, metricKey)));
  if (overall == null) return null;
  let bestDay: string | null = null;
  let bestMean: number | null = null;
  let bestCount = 0;
  for (const [day, values] of byDay) {
    if (values.length < MIN_TREND_EACH_SIDE) continue;
    const mean = meanOfPresent(values);
    if (mean == null) continue;
    if (bestMean == null || mean > bestMean) {
      bestDay = day;
      bestMean = mean;
      bestCount = values.length;
    }
  }
  if (!bestDay || bestMean == null) return null;
  const delta = percentChange(bestMean, overall);
  if (delta == null || delta < MIN_RELATIVE_DELTA) return null;
  const confidence = confidenceFromSampleAndDelta(usable.length, delta);
  if (!confidence) return null;
  const bestEvidence = evidenceMetric(`${bestDay} ${metricKey}`, bestMean, metricKey);
  const overallEvidence = evidenceMetric(`Overall ${metricKey}`, overall, metricKey);
  if (!bestEvidence || !overallEvidence) return null;
  return {
    type: "publication_timing",
    confidence,
    metricKey,
    sampleSize: usable.length,
    campaignHeaderId: null,
    assignmentDeliverableId: null,
    formatFamily: null,
    platform: null,
    priority: 50,
    facts: {
      strongestWeekday: bestDay,
      strongestMean: bestMean,
      overallMean: overall,
      strongestCount: bestCount,
      sampleSize: usable.length,
      deltaPct: Math.round(delta * 1000) / 10,
      metricKey,
    },
    evidence: [
      { label: "Publications with dates", value: String(usable.length) },
      { label: `${bestDay} sample`, value: String(bestCount) },
      bestEvidence,
      overallEvidence,
    ],
  };
}

export function detectCampaignSpecific(
  observations: readonly CreatorPublicationObservation[],
  units: readonly UpcomingCreatorUnit[]
): DetectedCreatorInsight | null {
  const upcoming = units.filter(
    (unit) => unit.status === "to_do" || unit.status === "changes_requested"
  );
  if (upcoming.length === 0) return null;
  const strong = detectStrongContentType(observations);
  if (!strong?.formatFamily) return null;
  const match = upcoming.find(
    (unit) => contentFormatFamily(unit.deliverableType, null) === strong.formatFamily
  );
  if (!match) return null;
  return {
    ...strong,
    type: "campaign_specific",
    priority: 100,
    campaignHeaderId: match.campaignHeaderId,
    assignmentDeliverableId: match.assignmentDeliverableId,
    facts: {
      ...strong.facts,
      upcomingLabel: match.label,
      upcomingType: match.deliverableType,
      campaignHeaderId: match.campaignHeaderId,
    },
  };
}

export function detectDataEnrichment(input: {
  connections: readonly CreatorConnectionSnapshot[];
  dataLevel: 0 | 1 | 2;
  stale: boolean;
  observationCount: number;
}): DetectedCreatorInsight | null {
  const connectedReady = input.connections.filter(
    (row) => row.status === "connected" && row.lastSyncedAt && !input.stale
  );
  if (connectedReady.length > 0 && input.dataLevel === 2 && !input.stale) {
    return null;
  }
  const missing = suggestMissingProviders(input.connections);
  return {
    type: "data_enrichment",
    confidence: "low",
    metricKey: null,
    sampleSize: input.observationCount,
    campaignHeaderId: null,
    assignmentDeliverableId: null,
    formatFamily: null,
    platform: missing[0] ?? null,
    priority: 10,
    facts: {
      dataLevel: input.dataLevel,
      stale: input.stale,
      connectedCount: connectedReady.length,
      suggestedProvider: missing[0] ?? "social accounts",
      observationCount: input.observationCount,
    },
    evidence: [
      {
        label: "Connected platforms",
        value: String(input.connections.filter((row) => row.status === "connected").length),
      },
      { label: "Publications with history", value: String(input.observationCount) },
    ],
  };
}

function suggestMissingProviders(connections: readonly CreatorConnectionSnapshot[]): string[] {
  const connected = new Set(
    connections
      .filter((row) => row.status === "connected" || row.status === "syncing")
      .map((row) => row.provider)
  );
  const candidates: SocialProviderId[] = [
    "instagram",
    "tiktok",
    "youtube",
    "facebook",
    "twitter",
  ];
  const missing: string[] = [];
  for (const id of candidates) {
    if (connected.has(id)) continue;
    try {
      missing.push(getSocialProvider(id).displayName);
    } catch {
      missing.push(id);
    }
  }
  return missing;
}

export function detectUnitCompactInsights(
  observations: readonly CreatorPublicationObservation[]
): UnitCompactInsight[] {
  const ordered = sortNewestFirst(observations).filter(
    (row) => row.assignmentDeliverableId && hasCampaignPublication(row)
  );
  const out: UnitCompactInsight[] = [];
  for (const row of ordered) {
    if (!row.assignmentDeliverableId) continue;
    const peers = sameFormatObservations(ordered, row.formatFamily).filter(
      (peer) => peer.id !== row.id
    );
    const metricKey = chooseComparableMetric([row, ...peers], MIN_UNIT_BASELINE);
    if (!metricKey) continue;
    const own = metricValue(row, metricKey);
    const baseline = meanOfPresent(peers.slice(0, 10).map((peer) => metricValue(peer, metricKey)));
    const peerPresent = presentCount(peers.map((peer) => metricValue(peer, metricKey)));
    if (own == null || baseline == null || peerPresent < MIN_UNIT_BASELINE) continue;
    const delta = percentChange(own, baseline);
    if (delta == null || Math.abs(delta) < MIN_RELATIVE_DELTA) continue;
    const format = contentFormatSingular(row.formatFamily);
    const line =
      delta > 0
        ? `This ${format} is performing above your recent average.`
        : `This ${format} is currently below your recent average.`;
    out.push({
      assignmentDeliverableId: row.assignmentDeliverableId,
      assignmentPostScheduleId: row.assignmentPostScheduleId,
      campaignHeaderId: row.campaignHeaderId ?? "",
      line,
    });
  }
  return out;
}

function hasCampaignPublication(row: CreatorPublicationObservation): boolean {
  return row.source === "thinkway_publication" || row.source === "merged";
}

export function detectAllInsights(input: {
  observations: readonly CreatorPublicationObservation[];
  units: readonly UpcomingCreatorUnit[];
  connections: readonly CreatorConnectionSnapshot[];
  dataLevel: 0 | 1 | 2;
  stale: boolean;
}): DetectedCreatorInsight[] {
  const detected: Array<DetectedCreatorInsight | null> = [
    detectCampaignSpecific(input.observations, input.units),
    detectPerformanceTrend(input.observations),
    detectStrongContentType(input.observations),
    detectEngagementOpportunity(input.observations),
    detectPublicationTiming(input.observations),
    detectDataEnrichment({
      connections: input.connections,
      dataLevel: input.dataLevel,
      stale: input.stale,
      observationCount: input.observations.length,
    }),
  ];
  return detected.filter((row): row is DetectedCreatorInsight => row != null);
}
