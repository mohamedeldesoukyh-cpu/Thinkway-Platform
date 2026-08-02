import type {
  PerformanceReliabilityLevel,
  PerformanceStabilityLevel,
  PerformanceTrendLabel,
  PublishingEffectivenessLevel,
} from "@/lib/enterprise-creator-intelligence/performance/types";

/** Classify performance trend from short vs long window averages. */
export function classifyPerformanceTrend(
  recent: number | null,
  baseline: number | null,
  values: number[]
): PerformanceTrendLabel {
  if (recent == null && baseline == null && values.length === 0) return "Unknown";

  const cv = coefficientOfVariation(values);
  if (cv != null && cv >= 0.75 && values.length >= 4) return "Volatile";

  if (recent == null || baseline == null) {
    if (values.length >= 3) {
      const first = average(values.slice(0, Math.ceil(values.length / 2)));
      const second = average(values.slice(Math.floor(values.length / 2)));
      if (first == null || second == null) return "Unknown";
      return classifyDelta(second, first);
    }
    return "Unknown";
  }

  const deltaRatio =
    baseline === 0 ? (recent > 0 ? 1 : 0) : (recent - baseline) / Math.abs(baseline);

  // Recovering: was down historically but recent rebound vs mid-series low.
  if (values.length >= 4) {
    const mid = average(values.slice(0, Math.floor(values.length / 2)));
    const last = average(values.slice(Math.floor(values.length / 2)));
    if (
      mid != null &&
      last != null &&
      mid < baseline * 0.85 &&
      last > mid * 1.1 &&
      deltaRatio > -0.05
    ) {
      return "Recovering";
    }
  }

  return classifyDelta(recent, baseline);
}

function classifyDelta(recent: number, baseline: number): PerformanceTrendLabel {
  const deltaRatio =
    baseline === 0 ? (recent > 0 ? 1 : 0) : (recent - baseline) / Math.abs(baseline);
  if (Math.abs(deltaRatio) < 0.05) return "Stable";
  if (deltaRatio >= 0.05) return "Improving";
  return "Declining";
}

export function classifyStability(
  values: number[]
): { level: PerformanceStabilityLevel; cv: number | null } {
  const cv = coefficientOfVariation(values);
  if (cv == null) return { level: "Moderately Variable", cv: null };
  if (cv < 0.15) return { level: "Highly Stable", cv };
  if (cv < 0.3) return { level: "Stable", cv };
  if (cv < 0.5) return { level: "Moderately Variable", cv };
  if (cv < 0.75) return { level: "Volatile", cv };
  return { level: "Highly Volatile", cv };
}

export function classifyPublishingEffectiveness(input: {
  postingFrequencyPerWeek: number | null;
  sampleCount: number;
  spanDays: number;
}): PublishingEffectivenessLevel {
  const freq = input.postingFrequencyPerWeek;
  if (input.sampleCount === 0 || freq == null) return "Dormant";
  if (input.spanDays >= 60 && freq < 0.15) return "Dormant";
  if (freq >= 2) return "High consistency";
  if (freq >= 0.75) return "Medium consistency";
  return "Irregular";
}

export function classifyReliability(input: {
  stability: PerformanceStabilityLevel;
  confidencePercent: number | null;
  sampleCount: number;
  trend: PerformanceTrendLabel;
}): { level: PerformanceReliabilityLevel; why: string } {
  if (input.sampleCount < 3 || input.confidencePercent == null || input.confidencePercent < 35) {
    return {
      level: "Low Confidence",
      why: "Insufficient historical performance samples for reliability judgement.",
    };
  }
  if (
    input.stability === "Highly Volatile" ||
    input.stability === "Volatile" ||
    input.trend === "Volatile"
  ) {
    return {
      level: "Unpredictable",
      why: "Performance variance is high across the historical window.",
    };
  }
  if (
    input.stability === "Highly Stable" &&
    (input.confidencePercent ?? 0) >= 70 &&
    input.sampleCount >= 8
  ) {
    return {
      level: "Highly Reliable",
      why: "High sample coverage with highly stable historical performance.",
    };
  }
  if (
    (input.stability === "Stable" || input.stability === "Highly Stable") &&
    (input.confidencePercent ?? 0) >= 55
  ) {
    return {
      level: "Reliable",
      why: "Stable historical performance with adequate confidence.",
    };
  }
  return {
    level: "Moderately Reliable",
    why: "Moderate variance or confidence — usable with Planning caution.",
  };
}

export function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values);
  if (mean == null || mean === 0) return null;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

/** Pearson correlation between aligned series (posting intensity proxy vs performance). */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const n = xs.length;
  const meanX = average(xs)!;
  const meanY = average(ys)!;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX <= 0 || denY <= 0) return null;
  return Number((num / Math.sqrt(denX * denY)).toFixed(4));
}

export function detectSeasonality(postedAtValues: Array<string | null>): {
  detected: boolean;
  peakMonth: number | null;
  note: string;
} {
  const months = postedAtValues
    .map((v) => (v ? new Date(v).getUTCMonth() + 1 : null))
    .filter((m): m is number => m != null);
  if (months.length < 8) {
    return {
      detected: false,
      peakMonth: null,
      note: "Insufficient dated samples to detect seasonality (need ≥8).",
    };
  }
  const counts = new Map<number, number>();
  for (const m of months) counts.set(m, (counts.get(m) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  if (!top) {
    return { detected: false, peakMonth: null, note: "No seasonal peak detected." };
  }
  const detected = second == null || top[1] >= second[1] * 1.5;
  return {
    detected,
    peakMonth: detected ? top[0] : null,
    note: detected
      ? `Seasonal concentration around month ${top[0]} (extension signal only — not a forecast).`
      : "No strong seasonal concentration detected.",
  };
}
