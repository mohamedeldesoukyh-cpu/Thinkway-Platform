import type {
  AudienceGrowthTrend,
  AudienceQualityLevel,
  AudienceStabilityLevel,
} from "@/lib/enterprise-creator-intelligence/audience/types";
import {
  average,
  coefficientOfVariation,
  detectSeasonality,
} from "@/lib/enterprise-creator-intelligence/performance/trends";

const SPIKE_THRESHOLD = 0.15;
const DROP_THRESHOLD = -0.15;

export function classifyGrowthTrend(input: {
  growthRates: number[];
  latestGrowth: number | null;
}): AudienceGrowthTrend {
  const { growthRates, latestGrowth } = input;
  if (latestGrowth == null && growthRates.length === 0) return "Unknown";

  if (latestGrowth != null && latestGrowth >= SPIKE_THRESHOLD) return "Spike";
  if (latestGrowth != null && latestGrowth <= DROP_THRESHOLD) return "Drop";

  const avg = average(growthRates.filter((n) => Number.isFinite(n)));
  if (avg == null) return "Unknown";
  if (Math.abs(avg) < 0.02) return "Stable";
  if (avg > 0) return "Growing";
  return "Declining";
}

export function detectSpikesAndDrops(
  series: Array<{ at: string; growthRate: number | null }>
): {
  spikes: Array<{ at: string; growthPercent: number }>;
  drops: Array<{ at: string; growthPercent: number }>;
} {
  const spikes: Array<{ at: string; growthPercent: number }> = [];
  const drops: Array<{ at: string; growthPercent: number }> = [];
  for (const row of series) {
    if (row.growthRate == null) continue;
    if (row.growthRate >= SPIKE_THRESHOLD) {
      spikes.push({
        at: row.at,
        growthPercent: Number((row.growthRate * 100).toFixed(2)),
      });
    } else if (row.growthRate <= DROP_THRESHOLD) {
      drops.push({
        at: row.at,
        growthPercent: Number((row.growthRate * 100).toFixed(2)),
      });
    }
  }
  return { spikes, drops };
}

/**
 * Audience quality from supported indicators only.
 * Never estimates fake followers.
 */
export function classifyAudienceQuality(input: {
  demographicSource: string | null;
  hasGender: boolean;
  hasAge: boolean;
  hasCountries: boolean;
  authenticityScore: number | null;
}): { level: AudienceQualityLevel; indicators: string[]; why: string } {
  const indicators: string[] = [];
  const source = (input.demographicSource ?? "unavailable").toLowerCase();

  if (source && source !== "unavailable") {
    indicators.push(`demographic_source=${source}`);
  }
  if (input.hasGender) indicators.push("gender_distribution");
  if (input.hasAge) indicators.push("age_distribution");
  if (input.hasCountries) indicators.push("country_distribution");
  if (input.authenticityScore != null) {
    indicators.push(`authenticity_score=${input.authenticityScore}`);
  }

  const trustedSource = ["modash", "hypeauditor", "creatoriq"].includes(source);
  const demoCoverage =
    Number(input.hasGender) + Number(input.hasAge) + Number(input.hasCountries);

  if (indicators.length === 0) {
    return {
      level: "Unknown",
      indicators,
      why: "No supported audience quality indicators available.",
    };
  }

  if (trustedSource && demoCoverage >= 2 && (input.authenticityScore ?? 70) >= 70) {
    return {
      level: "High Quality",
      indicators,
      why: "Trusted demographic source with strong coverage and authenticity signal.",
    };
  }

  if (demoCoverage >= 2 || (trustedSource && demoCoverage >= 1)) {
    return {
      level: "Good",
      indicators,
      why: "Supported demographic coverage is present.",
    };
  }

  if (demoCoverage === 1 || source === "manual" || source === "apify") {
    return {
      level: "Monitor",
      indicators,
      why: "Partial demographic coverage — monitor before high-stakes briefs.",
    };
  }

  return {
    level: "Low Confidence",
    indicators,
    why: "Sparse supported indicators — audience quality confidence is limited.",
  };
}

export function classifyAudienceStability(input: {
  followerSeries: number[];
  postedAts: string[];
  growthRates: number[];
}): { level: AudienceStabilityLevel; why: string } {
  const seasonality = detectSeasonality(input.postedAts);
  const cv = coefficientOfVariation(input.followerSeries);
  const avgGrowth = average(input.growthRates);

  if (seasonality.detected) {
    return {
      level: "Seasonal",
      why: seasonality.note,
    };
  }

  if (cv == null && input.followerSeries.length < 2) {
    return {
      level: "Stable",
      why: "Insufficient follower history — defaulting to Stable with low evidence.",
    };
  }

  // Recovering: recent growth positive after negative stretch
  if (input.growthRates.length >= 3) {
    const early = average(input.growthRates.slice(0, -1));
    const latest = input.growthRates[input.growthRates.length - 1]!;
    if (early != null && early < -0.02 && latest > 0.02) {
      return {
        level: "Recovering",
        why: "Follower growth turned positive after a softer period.",
      };
    }
  }

  if (cv != null && cv >= 0.35) {
    return { level: "Volatile", why: `Follower series CV=${cv.toFixed(3)} indicates volatility.` };
  }
  if (cv != null && cv < 0.1 && Math.abs(avgGrowth ?? 0) < 0.03) {
    return {
      level: "Highly Stable",
      why: "Low follower variance with modest growth movement.",
    };
  }
  return {
    level: "Stable",
    why: "Audience size movement is within a normal historical band.",
  };
}

export function normalizePercentSlices(
  entries: Array<{ key: string; label: string; value: number | null }>
): Array<{ key: string; label: string; percent: number | null }> {
  const present = entries.filter((e) => e.value != null && Number.isFinite(e.value));
  if (present.length === 0) {
    return entries.map((e) => ({ key: e.key, label: e.label, percent: null }));
  }
  // Values may already be percentages 0–100 or fractions 0–1.
  const max = Math.max(...present.map((e) => Number(e.value)));
  const scale = max <= 1.5 ? 100 : 1;
  return entries.map((e) => ({
    key: e.key,
    label: e.label,
    percent:
      e.value == null || !Number.isFinite(e.value)
        ? null
        : Number((Number(e.value) * scale).toFixed(2)),
  }));
}
