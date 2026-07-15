import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  computeWeekWeights,
  type ActivationApproach,
} from "@/features/campaign-director/debate/activation-plan";

import { normalizeWeekWeights, parseWeekWeightIntent } from "./media-plan-schedule";

const MIN_BRIEF_CHARS = 40;

/** True when the campaign object carries a client/strategy brief (not just objective defaults). */
export function hasCampaignBriefText(campaignObject: CampaignObject): boolean {
  return resolveBriefTextForScheduling(campaignObject).trim().length >= MIN_BRIEF_CHARS;
}

/** Unified brief text for scheduling — facts excerpt, summary narrative, strategy. */
export function resolveBriefTextForScheduling(campaignObject: CampaignObject): string {
  const facts = getCampaignFacts(campaignObject);
  const strategy =
    typeof campaignObject.sections.strategy?.content === "string"
      ? campaignObject.sections.strategy.content
      : "";
  const summary =
    typeof campaignObject.sections.summary?.content === "string"
      ? campaignObject.sections.summary.content
      : "";
  return [facts?.rawBriefExcerpt, summary, facts?.objective, strategy]
    .filter((part) => part?.trim())
    .join("\n")
    .trim();
}

function detectActivationApproach(text: string): ActivationApproach | undefined {
  const lower = text.toLowerCase();

  if (
    /\b(steady|sustain|always[-\s]?on|consistent cadence|even(?:ly)?\s+distribut|spread evenly|throughout)\b/i.test(
      lower
    ) &&
    !/\b(launch|front[-\s]?load|burst|peak)\b/i.test(lower)
  ) {
    return "even";
  }

  if (
    /\b(ramp|build[-\s]?up|build up|crescendo|grow(?:ing)?\s+(?:over|through)|accelerat)\b/i.test(
      lower
    )
  ) {
    return "ramp";
  }

  if (
    /\b(launch|go[-\s]?live|kick[-\s]?off|front[-\s]?load|burst|heavy\s+week\s+1|week\s+1\s+heavy|opening\s+wave|product\s+moment|peak\s+launch)\b/i.test(
      lower
    )
  ) {
    return "burst";
  }

  if (/\bawareness|reach|launch|introduc|new product|drop\b/i.test(lower)) {
    return "burst";
  }

  if (/\bengagement|ugc|community|participat|conversation\b/i.test(lower)) {
    return "ramp";
  }

  return undefined;
}

/** Boost specific weeks when the brief names peak / hero / product moments. */
function applyPeakWeekSignals(weights: number[], text: string): number[] {
  const next = [...weights];
  const lower = text.toLowerCase();

  for (const match of lower.matchAll(/\b(?:peak|hero|moment|launch|go[-\s]?live)\s+(?:in\s+)?week\s+(\d+)\b/g)) {
    const week = Number(match[1]);
    if (week >= 1 && week <= next.length) {
      next[week - 1]! += 25;
    }
  }

  for (const match of lower.matchAll(/\bweek\s+(\d+)\b[^.\n]{0,40}\b(?:peak|hero|launch|moment|main push)\b/g)) {
    const week = Number(match[1]);
    if (week >= 1 && week <= next.length) {
      next[week - 1]! += 20;
    }
  }

  const sum = next.reduce((total, weight) => total + weight, 0);
  if (sum <= 0) return weights;
  return normalizeWeekWeights(next, next.length);
}

/**
 * Derive week weights from brief strategy signals.
 * Returns undefined when there is no brief — caller should use round-robin distribution.
 * When brief exists but signals are weak, defaults to launch-weighted (burst), not even split.
 */
export function deriveWeekWeightsFromBrief(
  briefText: string,
  durationWeeks: number
): number[] | undefined {
  const trimmed = briefText.trim();
  if (trimmed.length < MIN_BRIEF_CHARS) return undefined;

  const weeks = Math.max(1, Math.min(52, durationWeeks));
  const parsedIntent = parseWeekWeightIntent(trimmed, weeks);
  if (parsedIntent) return parsedIntent;

  const approach = detectActivationApproach(trimmed) ?? "burst";
  let weights = computeWeekWeights(weeks, approach);
  weights = applyPeakWeekSignals(weights, trimmed);
  return normalizeWeekWeights(weights, weeks);
}

/** Resolve week weights: explicit schedule meta wins, then brief-derived, else undefined (even spread fallback). */
export function resolveMediaPlanWeekWeights(
  campaignObject: CampaignObject,
  durationWeeks: number
): number[] | undefined {
  const explicit = campaignObject.meta.mediaPlanSchedule?.weekWeights;
  if (explicit?.length) {
    return normalizeWeekWeights(explicit, durationWeeks);
  }

  const briefText = resolveBriefTextForScheduling(campaignObject);
  return deriveWeekWeightsFromBrief(briefText, durationWeeks);
}
