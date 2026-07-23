import type {
  CreatorForecastProfile,
  ForecastDataSource,
  ForecastProfileDiagnostics,
  ForecastReadiness,
  ForecastTrend,
  NormalizedHistoricalMetricPoint,
} from "./types";

export function computeTrend(series: NormalizedHistoricalMetricPoint[]): ForecastTrend {
  if (series.length < 2) return "unknown";
  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  if (first <= 0) return "unknown";
  const change = (last - first) / first;
  if (change > 0.05) return "up";
  if (change < -0.05) return "down";
  return "stable";
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function formatFreshnessLabel(days: number | null): string {
  if (days == null) return "Unknown";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function resolveReadiness(input: {
  historicalSampleCount: number;
  baselineSampleCount: number;
  followers: number | null;
}): ForecastReadiness {
  if (input.followers == null || input.followers <= 0) return "missing_performance";
  if (input.baselineSampleCount >= 5 || input.historicalSampleCount >= 10) return "ready";
  if (input.baselineSampleCount > 0 || input.historicalSampleCount > 0) {
    return "limited_historical";
  }
  return "benchmark_only";
}

export function buildProfileConfidence(input: {
  readiness: ForecastReadiness;
  historicalSampleCount: number;
  baselineSampleCount: number;
  dataFreshnessDays: number | null;
  isVerified: boolean;
}): { score: number; label: "low" | "medium" | "high" } {
  let score = 30;
  if (input.readiness === "ready") score += 35;
  else if (input.readiness === "limited_historical") score += 20;
  else if (input.readiness === "benchmark_only") score += 8;

  score += Math.min(20, input.baselineSampleCount * 2);
  score += Math.min(10, Math.floor(input.historicalSampleCount / 3));

  if (input.isVerified) score += 5;
  if (input.dataFreshnessDays != null && input.dataFreshnessDays <= 14) score += 8;
  if (input.dataFreshnessDays != null && input.dataFreshnessDays > 60) score -= 10;

  score = Math.min(100, Math.max(0, Math.round(score)));
  const label = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return { score, label };
}

export function buildProfileDiagnostics(
  profile: Pick<
    CreatorForecastProfile,
    | "readiness"
    | "forecastBaselines"
    | "publicationPerformance"
    | "historicalPerformance"
    | "confidence"
    | "freshness"
  > & {
    primaryBaselineSource: ForecastDataSource | null;
    sourceMapping: ForecastProfileDiagnostics["sourceMapping"];
  }
): ForecastProfileDiagnostics {
  const historicalSampleCount =
    profile.publicationPerformance.totalSamples +
    profile.historicalPerformance.followerSeries.length;
  const baselineSampleCount = profile.forecastBaselines.reduce(
    (sum, baseline) => sum + baseline.sampleCount,
    0
  );

  const reasons: string[] = [];
  if (profile.readiness === "ready") {
    reasons.push("Sufficient historical samples and baselines for forecast strategy selection.");
  } else if (profile.readiness === "limited_historical") {
    reasons.push("Limited creator history — forecasts may use blended benchmarks.");
  } else if (profile.readiness === "benchmark_only") {
    reasons.push("Insufficient creator history — platform benchmarks will be used.");
  } else {
    reasons.push("Missing follower or performance data — forecast confidence is reduced.");
  }

  if (profile.primaryBaselineSource) {
    reasons.push(`Primary baseline source: ${profile.primaryBaselineSource}.`);
  }

  return {
    forecastReady: profile.readiness !== "missing_performance",
    readiness: profile.readiness,
    historicalSampleCount,
    baselineSampleCount,
    primaryBaselineSource: profile.primaryBaselineSource,
    confidenceScore: profile.confidence.score,
    confidenceLabel: profile.confidence.label,
    lastUpdatedLabel: formatFreshnessLabel(profile.freshness.dataFreshnessDays),
    reasons,
    sourceMapping: profile.sourceMapping,
  };
}
