import { benchmarkFor } from "@/features/campaign-outputs/generators/generator-utils";

import { CATEGORY_REACH_ADJUSTMENTS } from "./config";
import type { CampaignForecastCreatorInput } from "./types";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function categoryAdjustment(categories: string[] | null | undefined): number {
  if (!categories?.length) return 1;
  for (const category of categories) {
    const key = normalizeToken(category);
    for (const [label, factor] of Object.entries(CATEGORY_REACH_ADJUSTMENTS)) {
      if (key.includes(label)) return factor;
    }
  }
  return 1;
}

export function platformBenchmarkReach(followers: number, platform: string): number {
  const bench = benchmarkFor(platform);
  return Math.round(followers * bench.reachFactor);
}

export function similarCreatorBenchmarkReach(
  followers: number,
  platform: string,
  categories?: string[] | null
): number {
  const base = platformBenchmarkReach(followers, platform);
  return Math.round(base * categoryAdjustment(categories));
}

export function resolveSimilarCreatorBenchmark(input: {
  followers: number;
  platform: string;
  categories?: string[] | null;
  niche?: string | null;
}): number {
  let reach = similarCreatorBenchmarkReach(input.followers, input.platform, input.categories);
  if (input.niche) {
    const nicheKey = normalizeToken(input.niche);
    const nicheFactor = CATEGORY_REACH_ADJUSTMENTS[nicheKey];
    if (nicheFactor) reach = Math.round(reach * nicheFactor);
  }
  return reach;
}

function jaccardOverlap(a: string[] | null | undefined, b: string[] | null | undefined): number {
  const setA = new Set((a ?? []).map(normalizeToken).filter(Boolean));
  const setB = new Set((b ?? []).map(normalizeToken).filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function shareLanguage(a: CampaignForecastCreatorInput, b: CampaignForecastCreatorInput): boolean {
  const langsA = new Set((a.languageCodes ?? []).map(normalizeToken));
  const langsB = new Set((b.languageCodes ?? []).map(normalizeToken));
  if (!langsA.size || !langsB.size) return false;
  for (const lang of langsA) {
    if (langsB.has(lang)) return true;
  }
  return false;
}

function shareCountry(a: CampaignForecastCreatorInput, b: CampaignForecastCreatorInput): boolean {
  const countriesA = new Set(
    [a.countryCode, ...(a.countryCodes ?? [])].filter(Boolean).map((c) => normalizeToken(c!))
  );
  const countriesB = new Set(
    [b.countryCode, ...(b.countryCodes ?? [])].filter(Boolean).map((c) => normalizeToken(c!))
  );
  if (!countriesA.size || !countriesB.size) return false;
  for (const country of countriesA) {
    if (countriesB.has(country)) return true;
  }
  return false;
}

function samePlatform(a: CampaignForecastCreatorInput, b: CampaignForecastCreatorInput): boolean {
  if (!a.platform || !b.platform) return false;
  return normalizeToken(a.platform) === normalizeToken(b.platform);
}

export type PairwiseOverlapEstimate = {
  creatorKeyA: string;
  creatorKeyB: string;
  overlapRate: number;
  signals: string[];
};

export function estimatePairwiseOverlap(
  a: CampaignForecastCreatorInput,
  b: CampaignForecastCreatorInput,
  config: { defaultPairOverlapRate: number; maxPairOverlapRate: number }
): PairwiseOverlapEstimate {
  const signals: string[] = [];
  let score = config.defaultPairOverlapRate;

  if (shareCountry(a, b)) {
    score += 0.15;
    signals.push("shared country");
  }
  if (shareLanguage(a, b)) {
    score += 0.1;
    signals.push("shared language");
  }
  if (samePlatform(a, b)) {
    score += 0.1;
    signals.push("same platform");
  }

  const categoryOverlap = jaccardOverlap(a.categories, b.categories);
  if (categoryOverlap > 0) {
    score += categoryOverlap * 0.15;
    signals.push(`category overlap ${Math.round(categoryOverlap * 100)}%`);
  }

  if (a.niche && b.niche && normalizeToken(a.niche) === normalizeToken(b.niche)) {
    score += 0.2;
    signals.push("same niche");
  }

  const demoOverlap = jaccardOverlap(a.audienceInterests, b.audienceInterests);
  if (demoOverlap > 0) {
    score += demoOverlap * 0.1;
    signals.push(`audience interest overlap ${Math.round(demoOverlap * 100)}%`);
  }

  if (!signals.length) {
    signals.push("default overlap assumption (limited intelligence data)");
  }

  return {
    creatorKeyA: a.creatorKey,
    creatorKeyB: b.creatorKey,
    overlapRate: Math.min(config.maxPairOverlapRate, score),
    signals,
  };
}

export type CampaignOverlapResult = {
  grossReach: number;
  overlapDeduction: number;
  estimatedReach: number;
  pairwiseAdjustments: PairwiseOverlapEstimate[];
  explanation: string[];
};

export function applyCampaignAudienceOverlap(input: {
  creatorInputs: CampaignForecastCreatorInput[];
  creatorReachByKey: Map<string, number>;
  config: {
    defaultPairOverlapRate: number;
    maxPairOverlapRate: number;
    defaultCampaignOverlapPerCreator: number;
  };
}): CampaignOverlapResult {
  const grossReach = [...input.creatorReachByKey.values()].reduce((sum, reach) => sum + reach, 0);
  const pairwiseAdjustments: PairwiseOverlapEstimate[] = [];
  let overlapDeduction = 0;

  const creators = input.creatorInputs;
  for (let i = 0; i < creators.length; i++) {
    for (let j = i + 1; j < creators.length; j++) {
      const left = creators[i]!;
      const right = creators[j]!;
      const pair = estimatePairwiseOverlap(left, right, input.config);
      pairwiseAdjustments.push(pair);

      const reachA = input.creatorReachByKey.get(left.creatorKey) ?? 0;
      const reachB = input.creatorReachByKey.get(right.creatorKey) ?? 0;
      overlapDeduction += Math.min(reachA, reachB) * pair.overlapRate;
    }
  }

  if (creators.length > 1 && overlapDeduction === 0) {
    overlapDeduction = grossReach * input.config.defaultCampaignOverlapPerCreator * (creators.length - 1);
  }

  const maxSingleReach = Math.max(0, ...input.creatorReachByKey.values());
  const estimatedReach = Math.max(maxSingleReach, Math.round(grossReach - overlapDeduction));

  const explanation = [
    `Gross reach (before overlap): ${grossReach.toLocaleString()}.`,
    `Audience overlap deduction: ${Math.round(overlapDeduction).toLocaleString()} across ${pairwiseAdjustments.length} creator pair${pairwiseAdjustments.length === 1 ? "" : "s"}.`,
    `Net estimated reach: ${estimatedReach.toLocaleString()}.`,
  ];

  if (pairwiseAdjustments.length > 0) {
    const topPair = pairwiseAdjustments.sort((a, b) => b.overlapRate - a.overlapRate)[0];
    if (topPair) {
      explanation.push(
        `Highest overlap pair (${Math.round(topPair.overlapRate * 100)}%): ${topPair.signals.join(", ")}.`
      );
    }
  }

  return {
    grossReach,
    overlapDeduction: Math.round(overlapDeduction),
    estimatedReach,
    pairwiseAdjustments,
    explanation,
  };
}
