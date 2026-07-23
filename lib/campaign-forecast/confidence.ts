import type {
  CampaignForecastCreatorInput,
  ConfidenceDeduction,
  ForecastConfidence,
  ForecastConfidenceScore,
} from "./types";

export function scoreToConfidenceLabel(score: number): ForecastConfidence {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function buildConfidenceScore(input: {
  creator: CampaignForecastCreatorInput;
  hasFollowers: boolean;
  hasEngagementRate: boolean;
  hasPlatform: boolean;
  hasDeliverables: boolean;
  followerCount: number;
  forecastStrategy: string;
  historicalSampleSize: number;
  estimatedOverlapRate?: number;
}): ForecastConfidenceScore {
  const bonuses: ConfidenceDeduction[] = [];
  const deductions: ConfidenceDeduction[] = [];
  let score = 25;

  if (input.hasFollowers) {
    score += 20;
    bonuses.push({ factor: "followers", points: 20, reason: "Follower count available." });
  } else {
    deductions.push({ factor: "followers", points: 20, reason: "Missing follower count." });
  }

  if (input.hasPlatform) {
    score += 10;
    bonuses.push({ factor: "platform", points: 10, reason: "Platform resolved." });
  } else {
    deductions.push({ factor: "platform", points: 10, reason: "Platform not specified." });
  }

  if (input.hasEngagementRate) {
    score += 12;
    bonuses.push({ factor: "engagement_rate", points: 12, reason: "Engagement rate available." });
  } else {
    deductions.push({ factor: "engagement_rate", points: 12, reason: "Engagement rate missing." });
  }

  if (input.historicalSampleSize >= 10) {
    score += 18;
    bonuses.push({
      factor: "historical_performance",
      points: 18,
      reason: `${input.historicalSampleSize} historical samples available.`,
    });
  } else if (input.historicalSampleSize > 0) {
    score += 10;
    bonuses.push({
      factor: "historical_performance",
      points: 10,
      reason: `${input.historicalSampleSize} limited historical samples.`,
    });
  } else {
    deductions.push({
      factor: "historical_performance",
      points: 15,
      reason: "No historical performance — using benchmark/multiplier fallback.",
    });
  }

  if (input.creator.isVerified) {
    score += 5;
    bonuses.push({ factor: "verification", points: 5, reason: "Platform-verified creator account." });
  }

  const freshness = input.creator.dataFreshnessDays;
  if (freshness != null && freshness <= 14) {
    score += 8;
    bonuses.push({ factor: "freshness", points: 8, reason: "Metrics refreshed within 14 days." });
  } else if (freshness != null && freshness > 60) {
    score -= 8;
    deductions.push({
      factor: "freshness",
      points: 8,
      reason: `Metrics are ${freshness} days old.`,
    });
  }

  const dna = input.creator.dnaCompleteness;
  if (dna != null && dna >= 0.7) {
    score += 6;
    bonuses.push({ factor: "dna", points: 6, reason: "Creator DNA profile is substantially complete." });
  } else if (dna != null && dna < 0.4) {
    deductions.push({ factor: "dna", points: 6, reason: "Limited Creator DNA completeness." });
  }

  const hasAudienceSignals =
    Boolean(input.creator.countryCode || input.creator.countryCodes?.length) &&
    Boolean(input.creator.categories?.length || input.creator.niche);
  if (hasAudienceSignals) {
    score += 8;
    bonuses.push({ factor: "audience_intelligence", points: 8, reason: "Country/category intelligence available for overlap." });
  } else {
    deductions.push({
      factor: "audience_intelligence",
      points: 8,
      reason: "Sparse audience intelligence — default overlap assumptions applied.",
    });
  }

  if (input.estimatedOverlapRate != null && input.estimatedOverlapRate > 0.25) {
    deductions.push({
      factor: "overlap",
      points: 5,
      reason: `High estimated audience overlap (${Math.round(input.estimatedOverlapRate * 100)}%).`,
    });
  }

  if (input.forecastStrategy === "generic_multiplier") {
    deductions.push({
      factor: "strategy",
      points: 8,
      reason: "Generic multiplier strategy — lowest precision tier.",
    });
  } else if (input.forecastStrategy === "historical_performance") {
    score += 10;
    bonuses.push({
      factor: "strategy",
      points: 10,
      reason: "Historical performance strategy selected.",
    });
  }

  if (input.followerCount >= 10_000) {
    score += 5;
  } else if (input.followerCount >= 1_000) {
    score += 2;
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  return {
    score,
    label: scoreToConfidenceLabel(score),
    deductions,
    bonuses,
  };
}

export function aggregateConfidence(scores: ForecastConfidenceScore[]): ForecastConfidenceScore {
  if (!scores.length) {
    return { score: 0, label: "low", deductions: [], bonuses: [] };
  }

  const avg = scores.reduce((sum, item) => sum + item.score, 0) / scores.length;
  const score = Math.round(avg);
  const deductions = scores.flatMap((item) => item.deductions).slice(0, 5);
  const bonuses = scores.flatMap((item) => item.bonuses).slice(0, 5);

  return {
    score,
    label: scoreToConfidenceLabel(score),
    deductions,
    bonuses,
  };
}

export function explainConfidence(score: ForecastConfidenceScore): string[] {
  const lines = [`Confidence score: ${score.score}/100 (${score.label}).`];
  for (const bonus of score.bonuses.slice(0, 4)) {
    lines.push(`+${bonus.points} ${bonus.factor}: ${bonus.reason}`);
  }
  for (const deduction of score.deductions.slice(0, 4)) {
    lines.push(`-${deduction.points} ${deduction.factor}: ${deduction.reason}`);
  }
  return lines;
}
