import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import {
  deriveWeekWeightsFromBrief,
  hasCampaignBriefText,
  resolveBriefTextForScheduling,
} from "./brief-media-plan-schedule";
import {
  buildMediaPlanStrategyNarrativeFromObject,
  buildRolloutStrategyNarrative,
  countTiers,
  formatTierCountSummary,
  isBriefCopyText,
  sanitizeBriefSignalText,
  sortedPlatforms as narrativeSortedPlatforms,
  type MediaPlanCreativeRecommendation,
  type MediaPlanStrategyNarrative,
  type MediaPlanWeeklyObjective,
} from "./media-plan-strategy-narrative";
import { deriveEffectiveWeekWeights } from "./media-plan-schedule";
import { resolveSlate, type SlateCreator } from "./output-inputs";
import { detectWeightProfile } from "./media-plan-weight-profile";

export type { MediaPlanCreativeRecommendation, MediaPlanStrategyNarrative, MediaPlanWeeklyObjective };
export { detectWeightProfile };

export type MediaPlanStrategySummary = {
  /** Client-facing executive summary — brief excerpt or summary narrative. */
  executiveSummary?: string;
  /** Campaign objective from facts. */
  objective?: string;
  /** How publishing is weighted across the campaign (e.g. launch burst). */
  launchApproach?: string;
  /** Human-readable week weight distribution rationale. */
  weekWeightRationale?: string;
  /** Suggested creator content themes by platform and format. */
  creativeDirection?: string[];
  /** Senior-strategy-director narrative sections — weight/platform/mix driven. */
  narrative?: MediaPlanStrategyNarrative;
  /** Week weights used on the calendar (percentages). */
  weekWeights?: number[];
  /** True when any client-facing strategy content is present. */
  hasContent: boolean;
};

export type MediaPlanStrategySummaryOptions = {
  platformAllocation?: Record<string, number>;
  serviceTypes?: string[];
};

const MAX_EXCERPT_CHARS = 480;
const MAX_STRATEGY_CHARS = 360;

const PLATFORM_CONTENT_THEMES: Record<string, string[]> = {
  tiktok: [
    "Dance challenges and trend-led hooks",
    "Comedy and relatable skits",
    "Lip-syncs and audio-driven formats",
    "Trend adaptations with creative audience participation",
  ],
  instagram: [
    "Reels with strong visual storytelling",
    "Lifestyle and seasonal content",
    "UGC-style Stories and authentic day-in-the-life moments",
    "Native product integration in Reels formats",
  ],
  youtube: [
    "Longer-form narrative and story-led content",
    "Tutorials and how-to demonstrations",
    "Behind-the-scenes and creator-led explainers",
  ],
  snapchat: [
    "Ephemeral Stories and AR-led lenses",
    "Raw, in-the-moment lifestyle snaps",
    "Youth-native trend participation",
  ],
  facebook: [
    "Community-oriented posts and shareable video",
    "Relatable lifestyle and family moments",
    "Event and launch announcement formats",
  ],
  twitter: [
    "Conversation-starting clips and hot takes",
    "Real-time trend commentary",
    "Thread-friendly narrative hooks",
  ],
  x: [
    "Conversation-starting clips and hot takes",
    "Real-time trend commentary",
    "Thread-friendly narrative hooks",
  ],
};

const DELIVERABLE_THEMES: Array<{ pattern: RegExp; theme: string }> = [
  { pattern: /\breels?\b/i, theme: "Short-form Reels optimised for scroll-stopping hooks" },
  { pattern: /\bstories?\b/i, theme: "Ephemeral Stories for authentic, day-of publishing" },
  { pattern: /\bvideo\b/i, theme: "Video-first content built for platform-native viewing" },
  { pattern: /\bpost\b/i, theme: "Feed posts with clear brand and product storytelling" },
  { pattern: /\blive\b/i, theme: "Live sessions for real-time audience engagement" },
];

function truncateText(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

function normalizePlatformKey(platform: string): string {
  return platform.trim().toLowerCase().replace(/\s+/g, "");
}

function describeLaunchApproach(weekWeights: number[]): string {
  const profile = detectWeightProfile(weekWeights);
  const distribution = weekWeights.map((weight, index) => `W${index + 1} ${weight}%`).join(", ");
  const first = weekWeights[0] ?? 0;
  const last = weekWeights[weekWeights.length - 1] ?? 0;

  switch (profile) {
    case "burst":
      return `Front-loaded activation (${distribution}) — Week 1 carries ${first}% to establish launch momentum.`;
    case "ramp":
    case "close":
      return `Building activation (${distribution}) — publishing peaks toward Week ${weekWeights.length} at ${last}%.`;
    case "mid_peak":
      return `Hero-moment activation (${distribution}) — weight concentrates mid-flight.`;
    case "sustain":
      return `Sustained rhythm (${distribution}) — even visibility across the flight.`;
    default:
      return `Custom activation cadence (${distribution}).`;
  }
}

function formatWeekDistribution(weekWeights: number[]): string {
  const parts = weekWeights.map((weight, index) => `Week ${index + 1}: ${weight}%`);
  return `Publishing distribution — ${parts.join(" · ")}.`;
}

export function describeScheduleAdjustment(
  baselineWeights: number[],
  effectiveWeights: number[],
  durationWeeks: number
): string | undefined {
  const earlyWeeks = Math.max(1, Math.ceil(durationWeeks / 2));
  const baselineEarly = baselineWeights
    .slice(0, earlyWeeks)
    .reduce((sum, weight) => sum + weight, 0);
  const effectiveEarly = effectiveWeights
    .slice(0, earlyWeeks)
    .reduce((sum, weight) => sum + weight, 0);

  if (effectiveEarly >= baselineEarly + 10) {
    return "Schedule adjusted to front-load launch momentum — creator slots were moved into early weeks to strengthen the opening burst while keeping lighter weight in the remaining period.";
  }
  if (effectiveEarly <= baselineEarly - 10) {
    return "Schedule adjusted to shift publishing weight toward later weeks, building toward a sustained or closing push.";
  }

  const baselineLate = baselineWeights
    .slice(earlyWeeks)
    .reduce((sum, weight) => sum + weight, 0);
  const effectiveLate = effectiveWeights
    .slice(earlyWeeks)
    .reduce((sum, weight) => sum + weight, 0);
  if (effectiveLate >= baselineLate + 10) {
    return "Schedule adjusted to concentrate more creator activity in the back half of the campaign.";
  }

  return "Schedule manually refined on the calendar to better match the activation plan.";
}

export function buildPublishingRhythmRationale(input: {
  weekWeights: number[];
  baselineWeights: number[];
  scheduleAdjusted: boolean;
  durationWeeks: number;
  briefText?: string;
  objective?: string;
}): string {
  if (input.briefText || input.objective) {
    return buildRolloutStrategyNarrative({
      weekWeights: input.weekWeights,
      baselineWeights: input.baselineWeights,
      scheduleAdjusted: input.scheduleAdjusted,
      durationWeeks: input.durationWeeks,
      briefText: input.briefText ?? "",
      objective: input.objective,
    });
  }

  const parts = [describeLaunchApproach(input.weekWeights), formatWeekDistribution(input.weekWeights)];

  if (input.scheduleAdjusted) {
    const adjustment = describeScheduleAdjustment(
      input.baselineWeights,
      input.weekWeights,
      input.durationWeeks
    );
    if (adjustment) parts.push(adjustment);
  }

  return parts.join(" ");
}

function sortedPlatformsByAllocation(
  platformAllocation: Record<string, number>
): Array<{ platform: string; count: number }> {
  return Object.entries(platformAllocation)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => ({ platform, count }));
}

function themesForPlatform(platform: string): string[] {
  const key = normalizePlatformKey(platform);
  for (const [pattern, themes] of Object.entries(PLATFORM_CONTENT_THEMES)) {
    if (key.includes(pattern) || pattern.includes(key)) return themes;
  }
  return ["Platform-native creator content aligned to audience behaviour"];
}

function themesFromDeliverables(serviceTypes: string[]): string[] {
  const themes: string[] = [];
  const joined = serviceTypes.join(" ");
  for (const entry of DELIVERABLE_THEMES) {
    if (entry.pattern.test(joined)) themes.push(entry.theme);
  }
  return themes;
}

function describeCreatorTierMix(slate: SlateCreator[]): string | undefined {
  const celebrities = slate.filter((creator) => /celebrity|star/i.test(creator.tier ?? ""));
  const macros = slate.filter((creator) => /macro/i.test(creator.tier ?? ""));
  const micros = slate.filter((creator) => /micro|nano/i.test(creator.tier ?? ""));

  if (celebrities.length && (macros.length || micros.length)) {
    const lead = celebrities.map((creator) => creator.displayName).join(" and ");
    const support =
      macros.length > 0
        ? `${macros.length} Macro creator${macros.length === 1 ? "" : "s"}`
        : `${micros.length} Micro creator${micros.length === 1 ? "" : "s"}`;
    return `${lead} lead with hero content that sets the campaign narrative, supported by ${support} for sustained reach and UGC-style authenticity.`;
  }

  if (celebrities.length === 1) {
    return `${celebrities[0]!.displayName} anchors the campaign with hero launch content.`;
  }

  if (macros.length >= 2) {
    return `${macros
      .slice(0, 2)
      .map((creator) => creator.displayName)
      .join(" and ")} drive relatable, mid-funnel storytelling across the flight.`;
  }

  return undefined;
}

/** Deterministic creative direction themes from platform mix, deliverables, and creator slate. */
export function buildCreativeDirectionThemes(
  campaignObject: CampaignObject,
  options?: MediaPlanStrategySummaryOptions
): string[] {
  const facts = getCampaignFacts(campaignObject);
  const slate = resolveSlate(campaignObject);
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const platformAllocation = options?.platformAllocation ?? {};
  const hasAllocation = Object.keys(platformAllocation).length > 0;
  const rankedPlatforms = hasAllocation
    ? sortedPlatformsByAllocation(platformAllocation)
    : platforms.map((platform) => ({ platform, count: 1 }));

  const themes: string[] = [];
  const seen = new Set<string>();

  const pushTheme = (theme: string) => {
    const trimmed = theme.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    themes.push(trimmed);
  };

  const tierNote = describeCreatorTierMix(slate);
  if (tierNote) pushTheme(tierNote);

  for (const { platform } of rankedPlatforms.slice(0, 3)) {
    for (const theme of themesForPlatform(platform).slice(0, 2)) {
      pushTheme(theme);
    }
  }

  const serviceTypes =
    options?.serviceTypes ??
    slate.flatMap((creator) => creator.serviceTypes ?? (creator.serviceLabel ? [creator.serviceLabel] : []));
  for (const theme of themesFromDeliverables(serviceTypes).slice(0, 2)) {
    pushTheme(theme);
  }

  if (themes.length < 4) {
    pushTheme("Creative interpretations that encourage audience participation and sharing");
  }
  if (themes.length < 5 && /summer|season|launch/i.test(resolveBriefTextForScheduling(campaignObject))) {
    pushTheme("Lifestyle and seasonal content aligned to the campaign moment");
  }

  return themes.slice(0, 6);
}

function derivePlatformAllocationFromSlate(
  slate: SlateCreator[],
  platforms: string[]
): Record<string, number> {
  const allocation: Record<string, number> = {};
  for (const creator of slate) {
    const platform = creator.platform ?? platforms[0] ?? "Instagram";
    const slotCount = creator.serviceTypes?.length ?? 1;
    allocation[platform] = (allocation[platform] ?? 0) + slotCount;
  }
  return allocation;
}

/** Build a Thinkway-authored executive summary — never raw brief email language. */
export function buildThinkwayExecutiveSummary(input: {
  objective?: string;
  audience?: string;
  durationWeeks: number;
  weekWeights: number[];
  platformAllocation: Record<string, number>;
  slate: SlateCreator[];
  briefText: string;
  narrative?: MediaPlanStrategyNarrative;
}): string | undefined {
  const objective = input.objective?.trim();
  const audience = input.audience?.trim();
  const briefSignal = sanitizeBriefSignalText(input.briefText);
  const ranked = narrativeSortedPlatforms(input.platformAllocation);
  const tierSummary = input.narrative?.evidence.tierSummary
    ?? (input.slate.length ? formatTierCountSummary(countTiers(input.slate)) : "");
  const weightNote = input.weekWeights.length
    ? input.narrative?.evidence.weekWeightDistribution
      ?? input.weekWeights.map((weight, index) => `W${index + 1} ${weight}%`).join(", ")
    : "";

  if (!objective && !briefSignal && !input.slate.length && !ranked.length) {
    return undefined;
  }

  const contextParts: string[] = [];
  if (objective) {
    contextParts.push(
      audience
        ? `The campaign targets ${objective.toLowerCase().replace(/\.$/, "")} among ${audience}.`
        : `The campaign targets ${objective.toLowerCase().replace(/\.$/, "")}.`
    );
  } else if (briefSignal) {
    const condensed = truncateText(briefSignal, 120).replace(/\.$/, "");
    contextParts.push(`Campaign context: ${condensed}.`);
  } else {
    contextParts.push(`This ${input.durationWeeks}-week influencer media plan structures creator publishing across the flight.`);
  }

  const recommendationParts: string[] = [];
  if (objective) {
    recommendationParts.push(
      `Based on this objective, Thinkway recommends a ${input.durationWeeks}-week activation`
    );
  } else {
    recommendationParts.push(`Thinkway recommends a ${input.durationWeeks}-week activation`);
  }

  if (ranked[0]) {
    recommendationParts.push(
      `with ${ranked[0].percentage}% publishing weight on ${ranked[0].platform}`
    );
    if (ranked[1]) {
      recommendationParts.push(`and ${ranked[1].percentage}% on ${ranked[1].platform}`);
    }
  }
  if (weightNote) {
    recommendationParts.push(`(${weightNote})`);
  }
  const recommendation = `${recommendationParts.join(" ")}.`;

  let execution: string;
  if (tierSummary && input.slate.length) {
    execution = `Execution deploys a ${input.slate.length}-creator slate (${tierSummary}) across platform-native formats with week-by-week objectives aligned to publishing weight.`;
  } else if (input.narrative?.rolloutStrategy) {
    execution = `Execution follows a weight-driven publishing cadence tuned to the campaign timeline.`;
  } else {
    execution = `Execution details will be finalised once the creator slate and publishing calendar are confirmed.`;
  }

  const combined = `${contextParts.join(" ")} ${recommendation} ${execution}`;
  if (isBriefCopyText(combined)) return undefined;
  return combined;
}

/**
 * Build a client-facing strategy summary for the media plan document.
 * Returns placeholder-friendly empty fields when no brief/strategy exists yet.
 */
export function buildMediaPlanStrategySummary(
  campaignObject: CampaignObject,
  options?: MediaPlanStrategySummaryOptions
): MediaPlanStrategySummary {
  const facts = getCampaignFacts(campaignObject);
  const durationWeeks = Math.max(1, facts?.durationWeeks ?? 4);
  const briefText = resolveBriefTextForScheduling(campaignObject);
  const strategySection =
    typeof campaignObject.sections.strategy?.content === "string"
      ? campaignObject.sections.strategy.content.trim()
      : "";
  const summarySection =
    typeof campaignObject.sections.summary?.content === "string"
      ? campaignObject.sections.summary.content.trim()
      : "";

  const objective = facts?.objective?.trim() || undefined;

  const strategyExcerpt = strategySection
    ? truncateText(strategySection, MAX_STRATEGY_CHARS)
    : undefined;

  const { weights: weekWeights, baselineWeights, scheduleAdjusted } = deriveEffectiveWeekWeights(
    campaignObject,
    durationWeeks
  );

  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const slate = resolveSlate(campaignObject);
  const platformAllocation =
    options?.platformAllocation ?? derivePlatformAllocationFromSlate(slate, platforms);

  const narrative =
    weekWeights.length && (hasCampaignBriefText(campaignObject) || slate.length > 0)
      ? buildMediaPlanStrategyNarrativeFromObject(campaignObject, {
          weekWeights,
          baselineWeights,
          scheduleAdjusted,
          durationWeeks,
          platformAllocation,
          slate,
        })
      : undefined;

  const executiveSummary = buildThinkwayExecutiveSummary({
    objective,
    audience: facts?.audience,
    durationWeeks,
    weekWeights,
    platformAllocation,
    slate,
    briefText,
    narrative,
  });

  const launchApproach =
    narrative?.rolloutStrategy
    ?? strategyExcerpt
    ?? (weekWeights.length ? describeLaunchApproach(weekWeights) : undefined);

  const weekWeightRationale = narrative?.rolloutStrategy
    ?? (weekWeights.length
      ? buildPublishingRhythmRationale({
          weekWeights,
          baselineWeights,
          scheduleAdjusted,
          durationWeeks,
          briefText,
          objective,
        })
      : undefined);

  const creativeDirection = narrative?.creativeRecommendations?.length
    ? narrative.creativeRecommendations.map((entry) => `${entry.format} — Reason: ${entry.reason}`)
    : buildCreativeDirectionThemes(campaignObject, {
        platformAllocation,
        serviceTypes: options?.serviceTypes,
      });

  const hasScheduleContext = hasCampaignBriefText(campaignObject) || slate.length > 0;

  const hasContent = Boolean(
    executiveSummary ||
      objective ||
      strategyExcerpt ||
      (hasScheduleContext &&
        (weekWeightRationale || narrative || creativeDirection.length))
  );

  return {
    executiveSummary,
    objective,
    launchApproach,
    weekWeightRationale,
    creativeDirection: creativeDirection.length ? creativeDirection : undefined,
    narrative,
    weekWeights,
    hasContent,
  };
}
