import { parseDurationFromText } from "../components/sections/shared/format-utils";
export const MIN_CAMPAIGN_DURATION_WEEKS = 1;
export const MAX_CAMPAIGN_DURATION_WEEKS = 52;
export const DEFAULT_CAMPAIGN_DURATION_WEEKS = 6;
export function clampCampaignDurationWeeks(weeks) {
    const rounded = Math.round(weeks);
    if (!Number.isFinite(rounded))
        return DEFAULT_CAMPAIGN_DURATION_WEEKS;
    return Math.min(MAX_CAMPAIGN_DURATION_WEEKS, Math.max(MIN_CAMPAIGN_DURATION_WEEKS, rounded));
}
/** Parse duration from free text; clamps to 1–52 weeks. */
export function parseDurationWeeks(text) {
    const match = text.match(/(\d+)\s*weeks?/i);
    const weeks = match?.[1] ? parseInt(match[1], 10) : DEFAULT_CAMPAIGN_DURATION_WEEKS;
    return clampCampaignDurationWeeks(weeks);
}
/**
 * Campaign Summary is the source of truth for duration.
 * Timeline AI output is intentionally excluded unless no summary/strategy context exists.
 * When campaignFacts is present, facts.durationWeeks takes precedence.
 */
export function resolveCampaignDurationWeeks(summaryText = "", strategyText = "", timelineText = "", campaignFacts) {
    if (campaignFacts?.durationWeeks) {
        return clampCampaignDurationWeeks(campaignFacts.durationWeeks);
    }
    const summaryDuration = parseDurationFromText(summaryText);
    if (summaryDuration) {
        const weeks = parseInt(summaryDuration, 10);
        if (Number.isFinite(weeks) && weeks > 0) {
            return clampCampaignDurationWeeks(weeks);
        }
    }
    const campaignContext = [summaryText, strategyText].filter(Boolean).join("\n");
    if (campaignContext.trim()) {
        return parseDurationWeeks(campaignContext);
    }
    if (timelineText.trim()) {
        return parseDurationWeeks(timelineText);
    }
    return DEFAULT_CAMPAIGN_DURATION_WEEKS;
}
export function resolveGoLiveWeek(durationWeeks) {
    return Math.max(MIN_CAMPAIGN_DURATION_WEEKS, durationWeeks - 1);
}
export function isGoLivePhase(phase) {
    return /go[- ]?live|launch|publish|publishing window/i.test(phase);
}
export function countGoLivePhases(weeks) {
    return weeks.filter((week) => isGoLivePhase(week.phase)).length;
}
