import {
  isWithinWindow,
  windowDaySpan,
} from "@/lib/enterprise-creator-intelligence/category-brand/windows";
import {
  computeCommercialEmv,
  computeCommercialRoi,
  computeImpliedBenchmarkCpm,
} from "@/lib/enterprise-creator-intelligence/commercial/formulas";
import {
  computeAverage,
  computePostingFrequencyPerWeek,
} from "@/lib/enterprise-creator-intelligence/historical/compute";
import {
  average,
  classifyPerformanceTrend,
  classifyPublishingEffectiveness,
  classifyReliability,
  classifyStability,
  detectSeasonality,
  pearsonCorrelation,
} from "@/lib/enterprise-creator-intelligence/performance/trends";
import type {
  AnalysisWindowKey,
  AudienceResponseInsight,
  CampaignPerformanceInsight,
  CreatorPerformanceIntelligence,
  PerformanceConfidence,
  PerformanceMetricKey,
  PerformanceMetricSnapshot,
  PerformanceSource,
  PerformanceTrendLabel,
  WindowPerformanceBundle,
} from "@/lib/enterprise-creator-intelligence/performance/types";
import {
  PERFORMANCE_CONSUMERS,
  PERFORMANCE_WINDOWS,
} from "@/lib/enterprise-creator-intelligence/performance/types";
import {
  computeEngagementRate,
  computeEngagements,
} from "@/lib/performance/engagement-rate-engine";

export type PerformancePublicationFact = {
  source: "campaign" | "organic";
  platform: string | null;
  postedAt: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagements: number | null;
  watchTimeSeconds: number | null;
  completionRate: number | null;
  impressions: number | null;
  cost: number | null;
  currency: string | null;
  campaignHeaderId: string | null;
};

export type CreatorPerformanceFacts = {
  influencerId: string;
  platform: string | null;
  computedAt?: string;
  publications: PerformancePublicationFact[];
  /** Attributed campaign revenue for ROI (Thinkway). */
  attributedRevenue?: number | null;
  /** Avg quoted cost for EMV benchmark (optional). */
  avgQuotedCost?: number | null;
};

const METRIC_LABELS: Record<PerformanceMetricKey, string> = {
  views: "Views",
  reach: "Reach",
  engagement: "Engagement",
  engagement_rate: "Engagement Rate",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  watch_time: "Watch Time",
  completion_rate: "Completion Rate",
};

function buildConfidence(sampleCount: number, window: AnalysisWindowKey): PerformanceConfidence {
  const days = windowDaySpan(window);
  const basedOn = [
    { label: "samples", value: sampleCount },
    { label: "days", value: days },
  ];
  const percent = Math.round(
    Math.min(100, Math.min(sampleCount / 40, 1) * 70 + Math.min(days / 180, 1) * 30)
  );
  return {
    percent: sampleCount === 0 ? null : percent,
    reason: `Based on ${sampleCount} samples, ${days} days.`,
    basedOn,
  };
}

function buildSource(input: {
  platform: string | null;
  refreshTime: string | null;
  confidence: number | null;
  method?: string;
}): PerformanceSource {
  return {
    platform: input.platform,
    collectionMethod:
      input.method ??
      "Aggregated from campaign_publications + influencer recent publications",
    refreshTime: input.refreshTime,
    confidence: input.confidence,
  };
}

function resolvedEngagements(pub: PerformancePublicationFact): number {
  if (pub.engagements != null && pub.engagements > 0) return pub.engagements;
  return computeEngagements({
    likes: pub.likes,
    comments: pub.comments,
    shares: pub.shares,
    saves: pub.saves,
    views: pub.views,
    reach: pub.reach,
  });
}

function windowMetrics(
  pubs: PerformancePublicationFact[],
  window: AnalysisWindowKey,
  asOfMs: number,
  platform: string | null,
  lastUpdated: string,
  baselineByKey: Partial<Record<PerformanceMetricKey, number | null>>
): WindowPerformanceBundle {
  const inWindow = pubs.filter((p) => isWithinWindow(p.postedAt, window, asOfMs));
  const confidence = buildConfidence(inWindow.length, window);
  const source = buildSource({
    platform,
    refreshTime: lastUpdated,
    confidence: confidence.percent,
  });

  const views = inWindow.map((p) => p.views).filter((v): v is number => v != null);
  const reach = inWindow.map((p) => p.reach).filter((v): v is number => v != null);
  const likes = inWindow.map((p) => p.likes).filter((v): v is number => v != null);
  const comments = inWindow.map((p) => p.comments).filter((v): v is number => v != null);
  const shares = inWindow.map((p) => p.shares).filter((v): v is number => v != null);
  const saves = inWindow.map((p) => p.saves).filter((v): v is number => v != null);
  const watch = inWindow
    .map((p) => p.watchTimeSeconds)
    .filter((v): v is number => v != null);
  const completion = inWindow
    .map((p) => p.completionRate)
    .filter((v): v is number => v != null);
  const engagements = inWindow.map(resolvedEngagements).filter((v) => v > 0);
  const engagementRates = inWindow
    .map((p) =>
      computeEngagementRate({
        views: p.views,
        reach: p.reach,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saves: p.saves,
      }).engagement_rate
    )
    .filter((v): v is number => v != null);

  const values: Record<PerformanceMetricKey, number | null> = {
    views: computeAverage(views),
    reach: computeAverage(reach),
    engagement: computeAverage(engagements),
    engagement_rate: computeAverage(engagementRates),
    likes: computeAverage(likes),
    comments: computeAverage(comments),
    shares: computeAverage(shares),
    saves: computeAverage(saves),
    watch_time: computeAverage(watch),
    completion_rate: computeAverage(completion),
  };

  const seriesForTrend: Record<PerformanceMetricKey, number[]> = {
    views,
    reach,
    engagement: engagements,
    engagement_rate: engagementRates,
    likes,
    comments,
    shares,
    saves,
    watch_time: watch,
    completion_rate: completion,
  };

  const metrics: PerformanceMetricSnapshot[] = (
    Object.keys(METRIC_LABELS) as PerformanceMetricKey[]
  ).map((key) => {
    const value = values[key];
    const baseline = baselineByKey[key] ?? null;
    const trend = classifyPerformanceTrend(value, baseline, seriesForTrend[key]);
    const whatChanged =
      baseline == null || value == null
        ? `${METRIC_LABELS[key]} observed for ${window.replace(/_/g, " ")}.`
        : `${METRIC_LABELS[key]} moved from ${round(baseline)} to ${round(value)}.`;
    const why =
      inWindow.length === 0
        ? "No publications in this window."
        : `Derived from ${inWindow.length} historical performance samples.`;
    const businessImplication = implicationForTrend(METRIC_LABELS[key], trend);
    const missingInputs =
      value == null
        ? [key === "watch_time" || key === "completion_rate" ? `${key}_if_available` : key]
        : [];

    return {
      key,
      label: METRIC_LABELS[key],
      value: value == null ? null : Number(value.toFixed(4)),
      unit:
        key === "engagement_rate" || key === "completion_rate"
          ? "percent"
          : key === "watch_time"
            ? "seconds"
            : "count",
      confidence,
      trend,
      whatChanged,
      why,
      businessImplication,
      source,
      explainability: {
        value: value == null ? null : Number(value.toFixed(4)),
        meaning: `Average ${METRIC_LABELS[key]} over the ${window.replace(/_/g, " ")} window.`,
        confidence: confidence.percent,
        evidence: [confidence.reason, whatChanged],
        historicalTrend: whatChanged,
        businessContext: businessImplication,
        dataSource: source,
        lastUpdated: lastUpdated,
        missingInputs,
      },
    };
  });

  return {
    window,
    sampleCount: inWindow.length,
    metrics,
    missingInputs: inWindow.length === 0 ? ["publications_in_window"] : [],
  };
}

function round(value: number): string {
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(2);
}

function implicationForTrend(label: string, trend: PerformanceTrendLabel): string {
  switch (trend) {
    case "Improving":
      return `${label} is rising — Planning can lean on recent upside with normal confidence checks.`;
    case "Declining":
      return `${label} is falling — verify brief fit and consider volume/format changes.`;
    case "Volatile":
      return `${label} is volatile — avoid relying on a single recent spike.`;
    case "Recovering":
      return `${label} shows recovery after a softer period — monitor continuity.`;
    case "Stable":
      return `${label} is stable — suitable for predictable Planning assumptions.`;
    default:
      return `${label} trend is not yet established.`;
  }
}

function metricValue(
  bundle: WindowPerformanceBundle,
  key: PerformanceMetricKey
): number | null {
  return bundle.metrics.find((m) => m.key === key)?.value ?? null;
}

function buildAudienceResponse(input: {
  short: WindowPerformanceBundle;
  long: WindowPerformanceBundle;
  platform: string | null;
  lastUpdated: string;
}): AudienceResponseInsight[] {
  const pairs: Array<{
    key: AudienceResponseInsight["key"];
    label: string;
    metric: PerformanceMetricKey;
  }> = [
    { key: "view_trend", label: "View Trend", metric: "views" },
    { key: "reach_trend", label: "Reach Trend", metric: "reach" },
    { key: "engagement_trend", label: "Engagement Trend", metric: "engagement" },
    { key: "interaction_trend", label: "Interaction Trend", metric: "likes" },
    { key: "save_trend", label: "Save Trend", metric: "saves" },
    { key: "share_trend", label: "Share Trend", metric: "shares" },
  ];

  return pairs.map((pair) => {
    const recent = metricValue(input.short, pair.metric);
    const baseline = metricValue(input.long, pair.metric);
    const trend = classifyPerformanceTrend(recent, baseline, []);
    const confidence = buildConfidence(input.short.sampleCount, "last_30_days");
    const source = buildSource({
      platform: input.platform,
      refreshTime: input.lastUpdated,
      confidence: confidence.percent,
      method: "Historical audience response from short vs long performance windows",
    });
    const whatChanged =
      recent == null || baseline == null
        ? `${pair.label} lacks complete window comparison.`
        : `${pair.label}: ${round(baseline)} (180d) → ${round(recent)} (30d).`;

    return {
      key: pair.key,
      label: pair.label,
      trend,
      value: recent,
      confidence,
      source,
      explainability: {
        value: recent,
        meaning: `Historical ${pair.label.toLowerCase()} only — no prediction.`,
        confidence: confidence.percent,
        evidence: [whatChanged, confidence.reason],
        historicalTrend: whatChanged,
        businessContext: implicationForTrend(pair.label, trend),
        dataSource: source,
        lastUpdated: input.lastUpdated,
        missingInputs: recent == null ? [pair.metric] : [],
      },
    };
  });
}

function buildCampaignPerformance(input: {
  pubs: PerformancePublicationFact[];
  attributedRevenue: number | null;
  avgQuotedCost: number | null;
  platform: string | null;
  lastUpdated: string;
}): CampaignPerformanceInsight {
  const campaignPubs = input.pubs.filter((p) => p.source === "campaign");
  const campaignIds = new Set(
    campaignPubs.map((p) => p.campaignHeaderId).filter(Boolean)
  );
  const views = sum(campaignPubs.map((p) => p.views));
  const reach = sum(campaignPubs.map((p) => p.reach));
  const engagements = sum(campaignPubs.map(resolvedEngagements));
  const cost = sum(campaignPubs.map((p) => p.cost));
  const completion = computeAverage(
    campaignPubs.map((p) => p.completionRate).filter((v): v is number => v != null)
  );
  const impressions = sum(campaignPubs.map((p) => p.impressions ?? p.views));
  const avgViews = computeAverage(
    campaignPubs.map((p) => p.views).filter((v): v is number => v != null)
  );
  const benchmark = computeImpliedBenchmarkCpm(input.avgQuotedCost, avgViews);
  const roi = computeCommercialRoi(input.attributedRevenue, cost > 0 ? cost : null);
  const emv = computeCommercialEmv(impressions > 0 ? impressions : null, benchmark);
  const delivery =
    campaignPubs.length === 0
      ? null
      : campaignPubs.filter((p) => (p.views ?? 0) > 0 || (p.reach ?? 0) > 0).length /
        campaignPubs.length;

  const successTrend = classifyPerformanceTrend(
    avgViews,
    null,
    campaignPubs
      .map((p) => p.views)
      .filter((v): v is number => v != null)
  );

  const confidence = buildConfidence(campaignPubs.length, "lifetime");
  const source = buildSource({
    platform: input.platform,
    refreshTime: input.lastUpdated,
    confidence: confidence.percent,
    method:
      "Thinkway campaign_publications + commercial ROI/EMV formulas (no duplicated engines)",
  });

  const missingInputs: string[] = [];
  if (campaignPubs.length === 0) missingInputs.push("campaign_publications");
  if (input.attributedRevenue == null) missingInputs.push("attributed_revenue");
  if (cost <= 0) missingInputs.push("campaign_cost");

  return {
    campaignViews: views || null,
    campaignReach: reach || null,
    campaignEngagement: engagements || null,
    campaignRoi: roi,
    campaignEmv: emv,
    campaignCompletion: completion,
    campaignSuccess: successTrend,
    campaignDelivery: delivery == null ? null : Number(delivery.toFixed(4)),
    sampleCampaignCount: campaignIds.size,
    confidence,
    source,
    missingInputs,
    explainability: {
      value: roi ?? emv ?? views,
      meaning: "Historical Thinkway campaign performance aggregates.",
      confidence: confidence.percent,
      evidence: [
        `${campaignPubs.length} campaign publications`,
        `${campaignIds.size} campaigns`,
        confidence.reason,
      ],
      historicalTrend: `Campaign success trend: ${successTrend}.`,
      businessContext:
        "Planning can trust campaign history only where Thinkway delivery data exists.",
      dataSource: source,
      lastUpdated: input.lastUpdated,
      missingInputs,
    },
  };
}

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>(
    (s, v) => s + (v == null || !Number.isFinite(v) ? 0 : Number(v)),
    0
  );
}

/** Pure Performance Intelligence computation. */
export function computeCreatorPerformanceIntelligence(
  facts: CreatorPerformanceFacts
): CreatorPerformanceIntelligence {
  const computedAt = facts.computedAt ?? new Date().toISOString();
  const asOfMs = new Date(computedAt).getTime();
  const pubs = facts.publications;

  const lifetimeDraft = windowMetrics(
    pubs,
    "lifetime",
    asOfMs,
    facts.platform,
    computedAt,
    {}
  );
  const baselineByKey = Object.fromEntries(
    lifetimeDraft.metrics.map((m) => [m.key, m.value])
  ) as Partial<Record<PerformanceMetricKey, number | null>>;

  const windows = {} as Record<AnalysisWindowKey, WindowPerformanceBundle>;
  for (const window of PERFORMANCE_WINDOWS) {
    windows[window] =
      window === "lifetime"
        ? lifetimeDraft
        : windowMetrics(
            pubs,
            window,
            asOfMs,
            facts.platform,
            computedAt,
            baselineByKey
          );
  }

  // Prefer 30d vs 180d for overall trend on views (primary Planning signal).
  const shortViews = metricValue(windows.last_30_days, "views");
  const longViews = metricValue(windows.last_180_days, "views");
  const viewSeries = pubs
    .map((p) => p.views)
    .filter((v): v is number => v != null);
  const overallTrend = classifyPerformanceTrend(shortViews, longViews, viewSeries);
  const trendExplanation = {
    whatChanged:
      shortViews == null || longViews == null
        ? "Overall performance trend needs more dated view samples."
        : `Average views moved from ${round(longViews)} (180d) to ${round(shortViews)} (30d).`,
    why: `Classified from historical view behaviour across ${pubs.length} publications.`,
    businessImplication: implicationForTrend("Creator performance", overallTrend),
  };

  const stabilityBase = classifyStability(viewSeries);
  const stabilityConfidence = buildConfidence(viewSeries.length, "lifetime");
  const stabilitySource = buildSource({
    platform: facts.platform,
    refreshTime: computedAt,
    confidence: stabilityConfidence.percent,
    method: "Coefficient of variation across historical view samples",
  });
  const stability = {
    level: stabilityBase.level,
    coefficientOfVariation: stabilityBase.cv,
    meaning: `Performance stability is ${stabilityBase.level}.`,
    confidence: stabilityConfidence,
    explainability: {
      value: stabilityBase.level,
      meaning: `Performance stability is ${stabilityBase.level}.`,
      confidence: stabilityConfidence.percent,
      evidence: [
        stabilityBase.cv == null
          ? "CV unavailable"
          : `CV=${stabilityBase.cv.toFixed(3)}`,
        `${viewSeries.length} view samples`,
      ],
      historicalTrend: trendExplanation.whatChanged,
      businessContext:
        "Stability informs whether Planning can trust historical averages — not a quality score.",
      dataSource: stabilitySource,
      lastUpdated: computedAt,
      missingInputs: viewSeries.length < 2 ? ["view_series"] : [],
    },
  };

  const audienceResponse = buildAudienceResponse({
    short: windows.last_30_days,
    long: windows.last_180_days,
    platform: facts.platform,
    lastUpdated: computedAt,
  });

  const postedAts = pubs.map((p) => p.postedAt);
  const postingFrequency = computePostingFrequencyPerWeek(postedAts, {
    windowDays: 180,
  });
  const spanDays = (() => {
    const times = postedAts
      .map((v) => (v ? new Date(v).getTime() : NaN))
      .filter((t) => Number.isFinite(t));
    if (times.length < 2) return times.length > 0 ? 1 : 0;
    return Math.max(1, (Math.max(...times) - Math.min(...times)) / (1000 * 60 * 60 * 24));
  })();
  const publishingLevel = classifyPublishingEffectiveness({
    postingFrequencyPerWeek: postingFrequency,
    sampleCount: pubs.length,
    spanDays,
  });

  // Correlate weekly buckets of post counts vs average views.
  const weekBuckets = new Map<string, { posts: number; views: number[] }>();
  for (const pub of pubs) {
    if (!pub.postedAt) continue;
    const d = new Date(pub.postedAt);
    if (!Number.isFinite(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-W${Math.ceil(d.getUTCDate() / 7)}-${d.getUTCMonth()}`;
    const bucket = weekBuckets.get(key) ?? { posts: 0, views: [] };
    bucket.posts += 1;
    if (pub.views != null) bucket.views.push(pub.views);
    weekBuckets.set(key, bucket);
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const bucket of weekBuckets.values()) {
    const avgViews = average(bucket.views);
    if (avgViews == null) continue;
    xs.push(bucket.posts);
    ys.push(avgViews);
  }
  const correlation = pearsonCorrelation(xs, ys);
  const publishingConfidence = buildConfidence(pubs.length, "last_180_days");
  const publishingSource = buildSource({
    platform: facts.platform,
    refreshTime: computedAt,
    confidence: publishingConfidence.percent,
    method: "Posting frequency + correlation with weekly average views",
  });
  const publishingEffectiveness = {
    level: publishingLevel,
    postingFrequencyPerWeek: postingFrequency,
    performanceCorrelation: correlation,
    meaning: `Publishing effectiveness is ${publishingLevel}.`,
    confidence: publishingConfidence,
    explainability: {
      value: publishingLevel,
      meaning: `Publishing effectiveness is ${publishingLevel}.`,
      confidence: publishingConfidence.percent,
      evidence: [
        `Posts/week≈${postingFrequency ?? "n/a"}`,
        correlation == null
          ? "Correlation unavailable"
          : `Posting↔views correlation=${correlation}`,
      ],
      historicalTrend: trendExplanation.whatChanged,
      businessContext:
        "Publishing cadence vs performance helps Planning judge content operating rhythm.",
      dataSource: publishingSource,
      lastUpdated: computedAt,
      missingInputs: pubs.length === 0 ? ["publications"] : [],
    },
  };

  const campaignPerformance = buildCampaignPerformance({
    pubs,
    attributedRevenue: facts.attributedRevenue ?? null,
    avgQuotedCost: facts.avgQuotedCost ?? null,
    platform: facts.platform,
    lastUpdated: computedAt,
  });

  const reliabilityClass = classifyReliability({
    stability: stability.level,
    confidencePercent: stabilityConfidence.percent,
    sampleCount: pubs.length,
    trend: overallTrend,
  });
  const reliability = {
    level: reliabilityClass.level,
    meaning: `Performance reliability is ${reliabilityClass.level}.`,
    why: reliabilityClass.why,
    confidence: stabilityConfidence,
    explainability: {
      value: reliabilityClass.level,
      meaning: `Performance reliability is ${reliabilityClass.level}.`,
      confidence: stabilityConfidence.percent,
      evidence: [reliabilityClass.why, `Stability=${stability.level}`, `Trend=${overallTrend}`],
      historicalTrend: trendExplanation.whatChanged,
      businessContext:
        "Performance reliability (not operational reliability) for Planning trust in history.",
      dataSource: stabilitySource,
      lastUpdated: computedAt,
      missingInputs: pubs.length < 3 ? ["performance_samples"] : [],
    },
  };

  const seasonality = detectSeasonality(postedAts);
  const forecastReadiness = {
    historicalTrend: overallTrend,
    performanceStability: stability.level,
    seasonality,
    confidence: stabilityConfidence.percent,
    predictionExtension: {
      available: false as const,
      note: "Prediction not implemented in Sprint 4 — forecast readiness inputs only.",
    },
    explainability: {
      value: overallTrend,
      meaning: "Forecast readiness inputs for future prediction systems.",
      confidence: stabilityConfidence.percent,
      evidence: [
        `Trend=${overallTrend}`,
        `Stability=${stability.level}`,
        seasonality.note,
      ],
      historicalTrend: trendExplanation.whatChanged,
      businessContext:
        "Expose historical trend, stability, seasonality, and confidence — do not predict.",
      dataSource: stabilitySource,
      lastUpdated: computedAt,
      missingInputs: pubs.length === 0 ? ["publications"] : [],
    },
  };

  const source = buildSource({
    platform: facts.platform,
    refreshTime: computedAt,
    confidence: stabilityConfidence.percent,
  });

  return {
    influencerId: facts.influencerId,
    platform: facts.platform,
    computedAt,
    windows,
    overallTrend,
    trendExplanation,
    stability,
    audienceResponse,
    publishingEffectiveness,
    campaignPerformance,
    reliability,
    forecastReadiness,
    planningReadiness: {
      overallTrend,
      stability: stability.level,
      reliability: reliability.level,
      publishingEffectiveness: publishingLevel,
      forecastReadiness,
      audienceResponse,
      campaignPerformanceAvailable: campaignPerformance.sampleCampaignCount > 0,
    },
    source,
    aiHints: {
      available: pubs.length > 0,
      overallTrend,
      stability: stability.level,
      reliability: reliability.level,
      recommendRefresh: pubs.length === 0,
    },
    consumers: PERFORMANCE_CONSUMERS,
  };
}
