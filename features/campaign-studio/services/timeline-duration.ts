import { parseDurationFromText } from "../components/sections/shared/format-utils";

export const MIN_CAMPAIGN_DURATION_WEEKS = 1;
export const MAX_CAMPAIGN_DURATION_WEEKS = 52;
export const DEFAULT_CAMPAIGN_DURATION_WEEKS = 6;

/** Integer campaign length in weeks (1–52 after clamping). */
export type CampaignDurationWeeks = number;

export function clampCampaignDurationWeeks(weeks: number): CampaignDurationWeeks {
  const rounded = Math.round(weeks);
  if (!Number.isFinite(rounded)) return DEFAULT_CAMPAIGN_DURATION_WEEKS;
  return Math.min(MAX_CAMPAIGN_DURATION_WEEKS, Math.max(MIN_CAMPAIGN_DURATION_WEEKS, rounded));
}

function weeksFromUnitMatch(
  amount: number,
  unit: string
): CampaignDurationWeeks | undefined {
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("week")) return clampCampaignDurationWeeks(amount);
  if (normalized.startsWith("month")) return clampCampaignDurationWeeks(amount * 4);
  if (normalized.startsWith("day")) return clampCampaignDurationWeeks(amount / 7);
  return undefined;
}

/**
 * Parse duration only when the text actually states one.
 * 1 month → 4 weeks. No match → undefined (never invent 6).
 */
export function parseOptionalDurationWeeks(text: string): number | undefined {
  const labeled = text.match(
    /\b(?:duration|timeline)\s*[:：]\s*(\d+(?:\.\d+)?)\s*(weeks?|months?|days?)\b/i
  );
  if (labeled?.[1] && labeled[2]) {
    return weeksFromUnitMatch(Number(labeled[1]), labeled[2]);
  }

  const explicit = text.match(/(\d+(?:\.\d+)?)\s*(weeks?|months?|days?)\b/i);
  if (explicit?.[1] && explicit[2]) {
    return weeksFromUnitMatch(Number(explicit[1]), explicit[2]);
  }

  return undefined;
}

/** Parse duration from free text; clamps to 1–52 weeks. Missing duration defaults to 6 for legacy callers. */
export function parseDurationWeeks(text: string): CampaignDurationWeeks {
  return parseOptionalDurationWeeks(text) ?? DEFAULT_CAMPAIGN_DURATION_WEEKS;
}

/**
 * Campaign Summary is the source of truth for duration when no facts exist.
 * When campaignFacts is present, facts.durationWeeks is the only duration —
 * missing facts duration is not inferred from AI/summary/timeline text.
 */
export function resolveCampaignDurationWeeks(
  summaryText = "",
  strategyText = "",
  timelineText = "",
  campaignFacts?: import("@/features/campaign-director/facts/campaign-facts-types").CampaignFacts
): CampaignDurationWeeks | undefined {
  if (campaignFacts) {
    if (campaignFacts.durationWeeks == null) return undefined;
    return clampCampaignDurationWeeks(campaignFacts.durationWeeks);
  }

  const fromSummary = parseOptionalDurationWeeks(summaryText);
  if (fromSummary != null) return fromSummary;

  const summaryDuration = parseDurationFromText(summaryText);
  if (summaryDuration) {
    const fromLabel = parseOptionalDurationWeeks(summaryDuration);
    if (fromLabel != null) return fromLabel;
    const weeks = parseInt(summaryDuration, 10);
    if (Number.isFinite(weeks) && weeks > 0) {
      return clampCampaignDurationWeeks(weeks);
    }
  }

  const campaignContext = [summaryText, strategyText].filter(Boolean).join("\n");
  const fromContext = parseOptionalDurationWeeks(campaignContext);
  if (fromContext != null) return fromContext;

  if (timelineText.trim()) {
    const fromTimeline = parseOptionalDurationWeeks(timelineText);
    if (fromTimeline != null) return fromTimeline;
  }

  return DEFAULT_CAMPAIGN_DURATION_WEEKS;
}

export function resolveGoLiveWeek(durationWeeks: number): number {
  return Math.max(MIN_CAMPAIGN_DURATION_WEEKS, durationWeeks - 1);
}

export function isGoLivePhase(phase: string): boolean {
  return /go[- ]?live|launch|publish|publishing window/i.test(phase);
}

export function countGoLivePhases(weeks: Array<{ phase: string }>): number {
  return weeks.filter((week) => isGoLivePhase(week.phase)).length;
}
