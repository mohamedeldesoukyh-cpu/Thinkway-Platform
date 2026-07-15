import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";

import { parseAggregatedServiceLabel } from "./hydration/quotation-service-types";
import { resolveBriefTextForScheduling } from "./brief-media-plan-schedule";
import { detectWeightProfile } from "./media-plan-weight-profile";
import type { SlateCreator } from "./output-inputs";

export type StrategyConfidenceLevel = "high" | "medium" | "low";

export type MediaPlanStrategySectionConfidence = {
  level: StrategyConfidenceLevel;
  reason: string;
};

export type MediaPlanCreativeRecommendation = {
  format: string;
  reason: string;
  confidence?: StrategyConfidenceLevel;
};

export type MediaPlanWeeklyObjective = {
  week: number;
  phase: string;
  weight: number;
  goals: string[];
};

export type MediaPlanStrategyEvidence = {
  durationWeeks: number;
  weekWeightDistribution: string;
  platformAllocation: Array<{ platform: string; count: number; percentage: number }>;
  tierSummary: string;
  tierCounts: Partial<Record<CreatorTier, number>>;
  totalCreators: number;
  totalDeliverables: number;
  maxDeliverablesPerCreator: number;
  minDeliverablesPerCreator: number;
  objective?: string;
  audience?: string;
  songMentionedButUnknown: boolean;
  hasCreativeAssetDetails: boolean;
};

export type MediaPlanStrategyNarrative = {
  rolloutStrategy: string;
  rolloutConfidence: MediaPlanStrategySectionConfidence;
  platformIntelligence: string;
  platformConfidence: MediaPlanStrategySectionConfidence;
  creatorMixIntelligence: string;
  creatorMixConfidence: MediaPlanStrategySectionConfidence;
  weeklyObjectives: MediaPlanWeeklyObjective[];
  weeklyObjectivesConfidence: MediaPlanStrategySectionConfidence;
  creativeRecommendations: MediaPlanCreativeRecommendation[];
  creativeConfidence: MediaPlanStrategySectionConfidence;
  creativeLimitations?: string;
  creatorTypeRecommendations: MediaPlanCreativeRecommendation[];
  evidence: MediaPlanStrategyEvidence;
};

export type MediaPlanStrategyNarrativeInput = {
  weekWeights: number[];
  baselineWeights?: number[];
  scheduleAdjusted?: boolean;
  durationWeeks: number;
  platformAllocation: Record<string, number>;
  slate: SlateCreator[];
  briefText: string;
  objective?: string;
  audience?: string;
  industry?: string;
  platforms?: string[];
};

type CreatorTier = "mega" | "macro" | "mid" | "micro" | "nano" | "unknown";

const BRIEF_COPY_PATTERNS: RegExp[] = [
  /\bplease find below\b/i,
  /\bclient brief\b/i,
  /\bwe have an upcoming\b/i,
  /\bdear team\b/i,
  /\bhi team\b/i,
  /\bas discussed\b/i,
  /\battached (is|are|the)\b/i,
  /\bfwd:/i,
  /\bre:/i,
  /\bkind regards\b/i,
  /\bbest regards\b/i,
];

const HIGH_CONFIDENCE_FORMAT_PATTERNS = /\b(challenge|competition|lip-sync|duet|stitch|pov)\b/i;
const MULTI_POST_FORMAT_PATTERNS = /\b(challenge|competition|multi-part|funnel|winner|duet|stitch)\b/i;

type CreatorCategory =
  | "lifestyle"
  | "fashion"
  | "travel"
  | "food"
  | "comedy"
  | "dance"
  | "beauty"
  | "tech"
  | "general";

type BriefVertical = "music" | "beauty" | "telecom" | "retail" | "tourism" | "finance" | "general";

function normalizePlatformKey(platform: string): string {
  return platform.trim().toLowerCase().replace(/\s+/g, "");
}

function classifyTier(tier?: string): CreatorTier {
  const value = (tier ?? "").toLowerCase();
  if (/celebrity|mega|star|a-?list/.test(value)) return "mega";
  if (/\bmid\b|mid-tier|mid tier/.test(value)) return "mid";
  if (/macro/.test(value)) return "macro";
  if (/nano/.test(value)) return "nano";
  if (/micro/.test(value)) return "micro";
  return "unknown";
}

export function countTiers(slate: SlateCreator[]): Record<CreatorTier, number> {
  const counts: Record<CreatorTier, number> = {
    mega: 0,
    macro: 0,
    mid: 0,
    micro: 0,
    nano: 0,
    unknown: 0,
  };
  for (const creator of slate) {
    counts[classifyTier(creator.tier)] += 1;
  }
  return counts;
}

/** Detect verbatim client-brief email language that must not appear in strategy output. */
export function isBriefCopyText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return BRIEF_COPY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Strip brief-copy patterns and return usable signal text, or empty if only boilerplate. */
export function sanitizeBriefSignalText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || isBriefCopyText(trimmed)) return "";

  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !isBriefCopyText(sentence));

  return sentences.join(" ").trim();
}

export function deliverableCountForCreator(creator: SlateCreator): number {
  if (creator.serviceTypes?.length) return creator.serviceTypes.length;
  if (creator.serviceLabel?.trim()) {
    const parsed = parseAggregatedServiceLabel(creator.serviceLabel);
    return parsed.length || 1;
  }
  return 1;
}

export function slateDeliverableStats(slate: SlateCreator[]): {
  total: number;
  max: number;
  min: number;
  perCreator: number[];
} {
  const perCreator = slate.map((creator) => deliverableCountForCreator(creator));
  if (!perCreator.length) {
    return { total: 0, max: 0, min: 0, perCreator };
  }
  return {
    total: perCreator.reduce((sum, count) => sum + count, 0),
    max: Math.max(...perCreator),
    min: Math.min(...perCreator),
    perCreator,
  };
}

export function formatTierCountSummary(counts: Record<CreatorTier, number>): string {
  const labels: Array<[CreatorTier, string]> = [
    ["mega", "Mega"],
    ["macro", "Macro"],
    ["mid", "Mid"],
    ["micro", "Micro"],
    ["nano", "Nano"],
  ];
  return labels
    .filter(([tier]) => (counts[tier] ?? 0) > 0)
    .map(([tier, label]) => `${counts[tier]} ${label}`)
    .join(", ");
}

export function detectCreativeAssetAvailability(briefText: string): {
  hasSongReference: boolean;
  hasSongAsset: boolean;
  hasCreativeAssetDetails: boolean;
  songMentionedButUnknown: boolean;
} {
  const lower = briefText.toLowerCase();
  const hasSongReference = /\b(song|track|album|artist|lyrics|music|audio)\b/i.test(lower);
  const hasSongAsset =
    /\b(song (file|link|attached|provided)|track (provided|attached|link)|lyrics (provided|attached)|audio file|listen here|spotify|apple music|soundcloud)\b/i.test(
      lower
    );
  const hasCreativeAssetDetails = /\b(tempo|bpm|genre|mood|key|hook|chorus|verse|beat)\b/i.test(
    lower
  );
  return {
    hasSongReference,
    hasSongAsset,
    hasCreativeAssetDetails,
    songMentionedButUnknown: hasSongReference && !hasSongAsset && !hasCreativeAssetDetails,
  };
}

export function extractMediaPlanStrategyEvidence(
  input: MediaPlanStrategyNarrativeInput
): MediaPlanStrategyEvidence {
  const tierCounts = countTiers(input.slate);
  const deliverables = slateDeliverableStats(input.slate);
  const creativeAssets = detectCreativeAssetAvailability(input.briefText);

  return {
    durationWeeks: input.durationWeeks,
    weekWeightDistribution: formatWeightDistribution(input.weekWeights),
    platformAllocation: sortedPlatforms(input.platformAllocation),
    tierSummary: formatTierCountSummary(tierCounts),
    tierCounts,
    totalCreators: input.slate.length,
    totalDeliverables: deliverables.total,
    maxDeliverablesPerCreator: deliverables.max,
    minDeliverablesPerCreator: deliverables.min,
    objective: input.objective?.trim() || undefined,
    audience: input.audience?.trim() || undefined,
    songMentionedButUnknown: creativeAssets.songMentionedButUnknown,
    hasCreativeAssetDetails: creativeAssets.hasCreativeAssetDetails || creativeAssets.hasSongAsset,
  };
}

function weightFingerprint(weights: number[]): number {
  return weights.reduce((hash, weight, index) => hash + weight * (index + 1) * 17, 0);
}

function formatWeightDistribution(weights: number[]): string {
  return weights.map((weight, index) => `W${index + 1} ${weight}%`).join(", ");
}

function peakWeekIndex(weights: number[]): number {
  let peak = 0;
  for (let index = 1; index < weights.length; index++) {
    if ((weights[index] ?? 0) > (weights[peak] ?? 0)) peak = index;
  }
  return peak;
}

function detectBriefVertical(text: string, industry?: string): BriefVertical {
  const lower = text.toLowerCase();
  if (/\b(song|music|track|album|artist|lip[-\s]?sync|dance challenge|summer hit)\b/i.test(lower)) {
    return "music";
  }
  if (/\b(beauty|skincare|makeup|cosmetic|grwm|get ready with me)\b/i.test(lower)) {
    return "beauty";
  }
  if (industry === "telecom" || /\b(5g|telecom|telco|mobile network|connectivity)\b/i.test(lower)) {
    return "telecom";
  }
  if (industry === "tourism" || /\b(tourism|travel|destination|visit)\b/i.test(lower)) {
    return "tourism";
  }
  if (industry === "retail" || /\b(fashion|apparel|retail|sneaker|collection drop)\b/i.test(lower)) {
    return "retail";
  }
  if (industry === "finance" || /\b(bank|finance|fintech|insurance)\b/i.test(lower)) {
    return "finance";
  }
  return "general";
}

function detectCreatorCategories(text: string, slate: SlateCreator[]): CreatorCategory[] {
  const lower = text.toLowerCase();
  const categories = new Set<CreatorCategory>();

  const signals: Array<{ category: CreatorCategory; patterns: RegExp[] }> = [
    { category: "dance", patterns: [/\bdance\b/i, /\bchoreograph/i, /\bmusic\b/i] },
    { category: "fashion", patterns: [/\bfashion\b/i, /\boutfit\b/i, /\bstyle\b/i, /\bapparel\b/i] },
    { category: "travel", patterns: [/\btravel\b/i, /\bdestination\b/i, /\btourism\b/i] },
    { category: "food", patterns: [/\bfood\b/i, /\bchef\b/i, /\brecipe\b/i, /\bculinary\b/i] },
    { category: "comedy", patterns: [/\bcomedy\b/i, /\bhumor\b/i, /\bskit\b/i, /\bfunny\b/i] },
    { category: "beauty", patterns: [/\bbeauty\b/i, /\bmakeup\b/i, /\bskincare\b/i] },
    { category: "lifestyle", patterns: [/\blifestyle\b/i, /\bvlog\b/i, /\bday[-\s]?in[-\s]?the[-\s]?life\b/i] },
    { category: "tech", patterns: [/\btech\b/i, /\bgadget\b/i, /\b5g\b/i] },
  ];

  for (const { category, patterns } of signals) {
    if (patterns.some((pattern) => pattern.test(lower))) categories.add(category);
  }

  for (const creator of slate) {
    const tier = classifyTier(creator.tier);
    if (tier === "mega" || tier === "macro") categories.add("lifestyle");
    if (tier === "micro" || tier === "nano") categories.add("comedy");
  }

  if (!categories.size) categories.add("general");
  return [...categories];
}

export function sortedPlatforms(
  platformAllocation: Record<string, number>
): Array<{ platform: string; count: number; percentage: number }> {
  const entries = Object.entries(platformAllocation).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => ({
      platform,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

function pickVariant<T>(variants: T[], seed: number): T {
  return variants[Math.abs(seed) % variants.length]!;
}

/** Unique rollout rationale driven by exact week weights — not static profile templates. */
export function buildRolloutStrategyNarrative(input: {
  weekWeights: number[];
  baselineWeights?: number[];
  scheduleAdjusted?: boolean;
  durationWeeks: number;
  briefText: string;
  objective?: string;
}): string {
  const { weekWeights, baselineWeights, scheduleAdjusted, briefText, objective } = input;
  if (!weekWeights.length) return "";

  const profile = detectWeightProfile(weekWeights);
  const distribution = formatWeightDistribution(weekWeights);
  const peak = peakWeekIndex(weekWeights);
  const first = weekWeights[0] ?? 0;
  const last = weekWeights[weekWeights.length - 1] ?? 0;
  const seed = weightFingerprint(weekWeights);
  const firstHalf = weekWeights.slice(0, Math.ceil(weekWeights.length / 2));
  const secondHalf = weekWeights.slice(Math.ceil(weekWeights.length / 2));
  const firstHalfShare = firstHalf.reduce((sum, weight) => sum + weight, 0);
  const secondHalfShare = secondHalf.reduce((sum, weight) => sum + weight, 0);

  const objectiveHook = objective?.trim()
    ? ` to advance the ${objective.trim().toLowerCase().replace(/\.$/, "")}`
    : "";

  let core: string;

  if (profile === "burst" || firstHalfShare >= 55) {
    const openers = [
      `A front-loaded rollout (${distribution}) concentrates ${first}% of creator publishing in Week 1, establishing immediate launch momentum${objectiveHook}.`,
      `Publishing weight tilts early (${distribution}), with Week 1 carrying ${first}% of the flight — designed to spark awareness and social conversation from day one${objectiveHook}.`,
      `The activation opens with decisive weight (${distribution}): ${first}% lands in Week 1 to capture relevance while audience attention is highest${objectiveHook}.`,
    ];
    const middles = [
      `Weeks 2–${weekWeights.length} taper deliberately (${weekWeights.slice(1).map((weight, index) => `W${index + 2} ${weight}%`).join(", ")}), sustaining visibility without oversaturating feeds.`,
      `Lighter weight in the back half keeps the story alive through earned conversation rather than volume alone.`,
      `The descending curve after the opening burst protects creative freshness while maintaining category presence through the close.`,
    ];
    core = `${pickVariant(openers, seed)} ${pickVariant(middles, seed + 3)}`;
  } else if (profile === "close" || profile === "ramp" || secondHalfShare >= 55) {
    const openers = [
      `A building rollout (${distribution}) staggers creator energy — Week 1 opens at ${first}% while the closing phase peaks at ${last}% in Week ${weekWeights.length}.`,
      `Publishing accelerates across the flight (${distribution}), reserving the heaviest concentration for the final weeks when conversion and sustained conversation matter most.`,
      `Rather than leading with volume, the schedule (${distribution}) cultivates anticipation early and concentrates ${last}% of activity in the closing window.`,
    ];
    const middles = [
      `This reversed weighting lets audience familiarity build before the hero push, maximising participation when the campaign narrative is most established.`,
      `Early weeks seed curiosity and UGC participation; the back-loaded curve ensures the peak lands when the audience is primed to act.`,
      `The progressive build mirrors how social conversation compounds — light touch first, then a decisive final-week surge.`,
    ];
    core = `${pickVariant(openers, seed)} ${pickVariant(middles, seed + 5)}`;
  } else if (profile === "mid_peak") {
    core = `Publishing peaks around Week ${peak + 1} (${weekWeights[peak]}%) with bookend weeks at ${first}% (W1) and ${last}% (W${weekWeights.length}) — a hero-moment architecture (${distribution}) that builds anticipation, concentrates the main push mid-flight, then sustains conversation through the close${objectiveHook}.`;
  } else if (profile === "sustain") {
    core = `A steady rhythm (${distribution}) maintains consistent visibility across all ${weekWeights.length} weeks — each week carries comparable weight to keep the brand present throughout the activation without sharp peaks or drop-offs${objectiveHook}.`;
  } else {
    const peakNote =
      peak > 0 && peak < weekWeights.length - 1
        ? ` with a local peak in Week ${peak + 1} (${weekWeights[peak]}%)`
        : "";
    core = `The week-by-week distribution (${distribution})${peakNote} reflects a bespoke activation cadence tuned to this campaign's brief signals rather than a standard launch or ramp template${objectiveHook}.`;
  }

  if (scheduleAdjusted && baselineWeights?.length) {
    const baselinePeak = peakWeekIndex(baselineWeights);
    const effectivePeak = peakWeekIndex(weekWeights);
    if (effectivePeak < baselinePeak) {
      core += ` The calendar was refined to pull creator slots forward, strengthening the opening phase relative to the original plan.`;
    } else if (effectivePeak > baselinePeak) {
      core += ` Schedule adjustments shifted creator slots toward later weeks, reinforcing the closing push.`;
    } else {
      core += ` Manual calendar refinements rebalance slot placement while preserving the overall weight intent.`;
    }
  }

  if (/\b(summer|season|launch|drop|song|product)\b/i.test(briefText)) {
    core += ` Brief signals prioritise capturing the campaign moment while conversation is culturally relevant.`;
  }

  return core;
}

/** Platform allocation rationale with audience behaviour reasoning. */
export function buildPlatformIntelligenceNarrative(input: {
  platformAllocation: Record<string, number>;
  briefText: string;
  audience?: string;
  platforms?: string[];
}): string {
  const ranked = sortedPlatforms(input.platformAllocation);
  if (!ranked.length) {
    const fallback = input.platforms?.length ? input.platforms.join(" and ") : "the primary platforms";
    return `Creator content is distributed across ${fallback}, aligned to where the target audience discovers and engages with brand stories.`;
  }

  const dominant = ranked[0]!;
  const secondary = ranked[1];
  const audienceNote = input.audience?.trim()
    ? ` for ${input.audience.trim()}`
    : "";

  const dominantKey = normalizePlatformKey(dominant.platform);
  let dominantReason: string;

  if (dominantKey.includes("tiktok")) {
    const variants = [
      `${dominant.percentage}% on TikTok leverages the recommendation engine's viral distribution — short-form hooks, trend participation, and audio-driven discovery reach audiences${audienceNote} who consume entertainment-first content in scroll sessions.`,
      `TikTok carries ${dominant.percentage}% of slots because its algorithm rewards native, music-led and challenge-based formats that compound reach through duets, stitches, and For You Page amplification${audienceNote}.`,
      `With ${dominant.percentage}% weight on TikTok, the plan prioritises algorithmic reach and cultural velocity — the platform where trends originate and audience participation scales fastest${audienceNote}.`,
    ];
    dominantReason = pickVariant(variants, dominant.percentage);
  } else if (dominantKey.includes("instagram")) {
    const variants = [
      `${dominant.percentage}% on Instagram capitalises on Reels discovery and Stories intimacy — combining scroll-stopping short video with credible, lifestyle-integrated feed presence${audienceNote}.`,
      `Instagram receives ${dominant.percentage}% of publishing because Reels and Stories deliver both reach and brand credibility, especially for visually-led narratives${audienceNote}.`,
      `The ${dominant.percentage}% Instagram allocation reflects audience behaviour on a platform where Reels drive discovery and Stories sustain daily brand presence${audienceNote}.`,
    ];
    dominantReason = pickVariant(variants, dominant.percentage);
  } else if (dominantKey.includes("youtube")) {
    dominantReason = `YouTube carries ${dominant.percentage}% of the plan, favouring longer narrative arcs, tutorials, and search-discoverable content that builds depth and consideration${audienceNote}.`;
  } else if (dominantKey.includes("snap")) {
    dominantReason = `Snapchat accounts for ${dominant.percentage}% of slots, leaning into ephemeral Stories and AR-native formats that resonate with youth-first, in-the-moment consumption${audienceNote}.`;
  } else {
    dominantReason = `${dominant.platform} leads at ${dominant.percentage}%, reflecting where this audience segment is most active and receptive to creator-led brand content${audienceNote}.`;
  }

  if (!secondary) return dominantReason;

  const secondaryKey = normalizePlatformKey(secondary.platform);
  let secondaryReason: string;

  if (secondaryKey.includes("instagram") && dominantKey.includes("tiktok")) {
    secondaryReason = ` Instagram (${secondary.percentage}%) complements with Reels polish and Stories retention — capturing audiences who discover on TikTok but validate and follow brands on Instagram.`;
  } else if (secondaryKey.includes("tiktok") && dominantKey.includes("instagram")) {
    secondaryReason = ` TikTok (${secondary.percentage}%) adds trend velocity and participation formats alongside Instagram's credibility layer.`;
  } else if (secondaryKey.includes("youtube")) {
    secondaryReason = ` YouTube (${secondary.percentage}%) extends reach into longer-form storytelling and search-driven discovery.`;
  } else {
    secondaryReason = ` ${secondary.platform} (${secondary.percentage}%) provides complementary reach and format diversity to the primary channel mix.`;
  }

  return dominantReason + secondaryReason;
}

/** Creator tier mix rationale — only tiers present in the slate, with exact counts. */
export function buildCreatorMixIntelligenceNarrative(slate: SlateCreator[]): string {
  const counts = countTiers(slate);
  const total = slate.length;
  if (!total) {
    return "Creator tier mix cannot be assessed reliably — the slate has no confirmed creators yet.";
  }

  const mixSummary = formatTierCountSummary(counts);
  if (!mixSummary) {
    return `${total} creator${total === 1 ? "" : "s"} on the slate — tier classification is pending confirmation before mix rationale can be finalised.`;
  }

  const parts: string[] = [];

  if (counts.mega > 0) {
    parts.push(
      `${counts.mega} Mega anchor mass awareness and credibility — hero content that sets the campaign narrative`
    );
  }
  if (counts.macro > 0) {
    parts.push(
      `${counts.macro} Macro bridge visibility with audience affinity — relatable storytelling in interest communities`
    );
  }
  if (counts.mid > 0) {
    parts.push(
      `${counts.mid} Mid-tier creators balance reach and engagement — credible voices with community-level resonance`
    );
  }
  if (counts.micro > 0) {
    parts.push(
      `${counts.micro} Micro drive engagement and niche trust — higher interaction rates within specialised audiences`
    );
  }
  if (counts.nano > 0) {
    parts.push(
      `${counts.nano} Nano add posting frequency and UGC texture — everyday voices that make the campaign participatory`
    );
  }

  return `The ${total}-creator slate (${mixSummary}) layers tiers by role: ${parts.join("; ")}.`;
}

function deriveWeekPhase(weight: number, weekIndex: number, totalWeeks: number, avgWeight: number): string {
  const isFirst = weekIndex === 0;
  const isLast = weekIndex === totalWeeks - 1;

  if (isFirst && weight >= avgWeight + 5) return "Launch";
  if (isLast && weight >= avgWeight + 5) return "Final push";
  if (weight >= avgWeight + 8) return "Amplify";
  if (weight <= avgWeight - 6) return "Maintain";
  if (isFirst) return "Launch";
  if (isLast) return "Final push";
  if (weight >= avgWeight) return "Amplify";
  return "Maintain";
}

function goalsForWeek(input: {
  phase: string;
  weekIndex: number;
  totalWeeks: number;
  weight: number;
  briefText: string;
  objective?: string;
}): string[] {
  const { phase, weekIndex, totalWeeks, briefText, objective } = input;
  const goals: string[] = [];
  const vertical = detectBriefVertical(briefText);

  if (phase === "Launch") {
    goals.push("Establish awareness and introduce the campaign narrative");
    if (vertical === "music") goals.push("Seed the track through hooks, previews, and curiosity-driven teasers");
    else if (vertical === "beauty") goals.push("Reveal the hero product and set the visual tone");
    else if (vertical === "telecom") goals.push("Introduce the connectivity story and hero offer");
    else goals.push("Create first-impression buzz and social conversation starters");
  } else if (phase === "Amplify") {
    goals.push("Increase publishing volume and participation");
    goals.push("Encourage duets, stitches, comments, and UGC responses");
    if (objective?.match(/engagement|ugc|community/i)) {
      goals.push("Convert passive viewers into active participants");
    }
  } else if (phase === "Maintain") {
    goals.push("Sustain category presence without oversaturating feeds");
    goals.push("Reinforce key messages through varied creator perspectives");
  } else if (phase === "Final push") {
    goals.push("Concentrate energy on conversion and last-mile awareness");
    if (weekIndex === totalWeeks - 1) goals.push("Close the flight with decisive calls-to-action and recap content");
    else goals.push("Build anticipation toward the campaign peak");
  }

  if (/\bpeak|hero|moment\b/i.test(briefText) && weekIndex === Math.floor(totalWeeks / 2)) {
    goals.push("Deliver the hero moment identified in the brief");
  }

  return goals.slice(0, 3);
}

/** Per-week strategic objectives derived from weights, brief, and position. */
export function buildWeeklyObjectives(input: {
  weekWeights: number[];
  briefText: string;
  objective?: string;
}): MediaPlanWeeklyObjective[] {
  const { weekWeights, briefText, objective } = input;
  if (!weekWeights.length) return [];

  const avgWeight = weekWeights.reduce((sum, weight) => sum + weight, 0) / weekWeights.length;

  return weekWeights.map((weight, index) => {
    const phase = deriveWeekPhase(weight, index, weekWeights.length, avgWeight);
    return {
      week: index + 1,
      phase,
      weight,
      goals: goalsForWeek({
        phase,
        weekIndex: index,
        totalWeeks: weekWeights.length,
        weight,
        briefText,
        objective,
      }),
    };
  });
}

const VERTICAL_CREATIVE_FORMATS: Record<
  BriefVertical,
  Array<{ format: string; reason: string }>
> = {
  music: [
    {
      format: "Dance challenges",
      reason: "Audio-driven formats ride TikTok's recommendation engine and invite mass participation around the track.",
    },
    {
      format: "Lip-sync and sound-on Reels",
      reason: "Directly showcases the song while leveraging platform-native music discovery features.",
    },
    {
      format: "POV and transition videos",
      reason: "Low-friction storytelling formats that pair trending audio with relatable scenarios.",
    },
    {
      format: "Duets and stitches",
      reason: "Extends reach through creator-to-creator amplification and audience response chains.",
    },
  ],
  beauty: [
    {
      format: "Get Ready With Me (GRWM)",
      reason: "Integrates product naturally into a trusted routine, driving consideration through demonstration.",
    },
    {
      format: "Before/after transformations",
      reason: "Visual proof formats that compress efficacy into scroll-stopping comparison content.",
    },
    {
      format: "Tutorial and how-to",
      reason: "Educational content builds credibility and saves — high-intent engagement for beauty purchases.",
    },
    {
      format: "Ingredient explainers",
      reason: "Authority-led content that answers skepticism and supports premium positioning.",
    },
  ],
  telecom: [
    {
      format: "Speed test and connectivity demos",
      reason: "Tangible proof points that make network performance claims credible and shareable.",
    },
    {
      format: "Lifestyle connectivity moments",
      reason: "Shows the service in real-life contexts — gaming, streaming, travel — rather than abstract specs.",
    },
    {
      format: "Challenge and reaction formats",
      reason: "High-energy short-form that suits mass-reach telco campaigns and younger demographics.",
    },
    {
      format: "Day-in-the-life with seamless connectivity",
      reason: "Normalises the brand as an invisible enabler of everyday digital life.",
    },
  ],
  retail: [
    {
      format: "Outfit reveals and styling edits",
      reason: "Visual commerce formats that inspire purchase intent through aspirational presentation.",
    },
    {
      format: "Haul and unboxing",
      reason: "Discovery-oriented content that surfaces product range and creates excitement around new drops.",
    },
    {
      format: "Trend try-on",
      reason: "Participates in cultural moments while positioning the brand within current style conversations.",
    },
  ],
  tourism: [
    {
      format: "Destination POV and cinematic travel reels",
      reason: "Transportive visuals that trigger wanderlust and shareable aspiration.",
    },
    {
      format: "Hidden gems and local guides",
      reason: "Authentic discovery content that builds trust beyond polished brand advertising.",
    },
    {
      format: "Itinerary and experience vlogs",
      reason: "Consideration-stage content that helps audiences plan and imagine their visit.",
    },
  ],
  finance: [
    {
      format: "Myth-busting explainers",
      reason: "Reduces intimidation around financial products through clear, creator-voiced education.",
    },
    {
      format: "Day-in-the-life with product integration",
      reason: "Normalises financial tools as part of everyday decision-making rather than corporate messaging.",
    },
    {
      format: "Comparison and tip formats",
      reason: "Practical value content that earns saves and shares in a trust-sensitive category.",
    },
  ],
  general: [
    {
      format: "Platform-native short-form video",
      reason: "Optimised for algorithmic distribution and scroll-stopping first seconds.",
    },
    {
      format: "Story-led UGC",
      reason: "Authentic creator voice builds trust and encourages audience participation.",
    },
    {
      format: "Trend-adaptive hooks",
      reason: "Connects the brand to current cultural conversation without feeling forced.",
    },
  ],
};

const CREATOR_CATEGORY_FORMATS: Record<
  CreatorCategory,
  Array<{ format: string; reason: string }>
> = {
  lifestyle: [
    {
      format: "Day-in-the-life vlogs",
      reason: "Natural product integration within relatable daily routines.",
    },
    {
      format: "Aesthetic morning/evening routines",
      reason: "Lifestyle creators excel at aspirational yet accessible ritual content.",
    },
  ],
  fashion: [
    {
      format: "Outfit transitions and lookbooks",
      reason: "Showcases product range through dynamic visual storytelling.",
    },
    {
      format: "Styling tips and trend breakdowns",
      reason: "Positions the brand within current fashion conversation with authority.",
    },
  ],
  travel: [
    {
      format: "Destination cinematic reels",
      reason: "Travel creators deliver transportive visuals that inspire sharing and saves.",
    },
    {
      format: "Local experience guides",
      reason: "Authentic on-location content builds credibility for destination brands.",
    },
  ],
  food: [
    {
      format: "Recipe integrations and taste tests",
      reason: "Sensory content drives engagement and product trial intent.",
    },
    {
      format: "Behind-the-kitchen storytelling",
      reason: "Food creators humanise the brand through process and craft narratives.",
    },
  ],
  comedy: [
    {
      format: "Relatable skits and situational humour",
      reason: "Comedy formats maximise shareability and lower the barrier to brand mention.",
    },
    {
      format: "Trend parodies with brand integration",
      reason: "Rides existing memes while keeping the message entertaining, not advertorial.",
    },
  ],
  dance: [
    {
      format: "Choreographed challenge videos",
      reason: "Dance creators drive participation loops and audio-led viral potential.",
    },
    {
      format: "Tutorial breakdowns",
      reason: "Lowers participation barrier — viewers learn, then create their own versions.",
    },
  ],
  beauty: [
    {
      format: "GRWM and routine content",
      reason: "Demonstrates product in context with trusted creator endorsement.",
    },
    {
      format: "Honest review and wear-test",
      reason: "Beauty audiences value authenticity — real-time results build conversion confidence.",
    },
  ],
  tech: [
    {
      format: "Hands-on demos and speed comparisons",
      reason: "Tech creators make specifications tangible through live proof.",
    },
    {
      format: "Setup guides and productivity tips",
      reason: "Utility content earns saves and positions the product as an enabler.",
    },
  ],
  general: [
    {
      format: "Creator-native storytelling",
      reason: "Each creator interprets the brief in their authentic voice for maximum resonance.",
    },
  ],
};

function dominantPlatformName(platformAllocation: Record<string, number>): string | undefined {
  const ranked = sortedPlatforms(platformAllocation);
  return ranked[0]?.platform;
}

function isFormatAllowedForDeliverables(format: string, maxDeliverables: number): boolean {
  if (maxDeliverables <= 0) return false;
  if (maxDeliverables === 1) {
    return !MULTI_POST_FORMAT_PATTERNS.test(format);
  }
  if (maxDeliverables === 2) {
    return !/\b(competition|funnel|winner|multi-part)\b/i.test(format);
  }
  return true;
}

function deliverableAwareFormats(maxDeliverables: number, vertical: BriefVertical): MediaPlanCreativeRecommendation[] {
  if (maxDeliverables <= 0) return [];

  if (maxDeliverables === 1) {
    return [
      {
        format: "Lifestyle integration",
        reason: `With 1 deliverable per creator, content should weave the brand or track naturally into an authentic lifestyle moment — not a multi-post arc.`,
        confidence: "high",
      },
      {
        format: "Song usage in native context",
        reason: `A single post can feature the track as background audio within a relatable scenario once creative assets are confirmed.`,
        confidence: "medium",
      },
      {
        format: "Hook-first short-form video",
        reason: `One deliverable must stop the scroll immediately — a strong 3-second opener drives distribution on ${vertical === "music" ? "audio-led" : "short-form"} platforms.`,
        confidence: "high",
      },
    ];
  }

  if (maxDeliverables === 2) {
    return [
      {
        format: "Post 1 — Intro / awareness hook",
        reason: `First of 2 deliverables establishes the narrative and primes the audience for participation.`,
        confidence: "high",
      },
      {
        format: "Post 2 — Challenge or CTA",
        reason: `Second deliverable converts awareness into action — a challenge, duet prompt, or explicit call-to-participate.`,
        confidence: "medium",
      },
      {
        format: "Sequential storytelling pair",
        reason: `Two posts allow a setup-and-payoff structure without requiring a full multi-week funnel.`,
        confidence: "high",
      },
    ];
  }

  return [
    {
      format: "Awareness → challenge → engagement arc",
      reason: `With ${maxDeliverables}+ deliverables per creator, a full funnel from intro through participation to winner/recap content is viable.`,
      confidence: "medium",
    },
    {
      format: "Multi-part challenge series",
      reason: `Multiple posts support escalating participation formats — teaser, challenge launch, UGC response, and finale.`,
      confidence: "medium",
    },
    {
      format: "Competition or winner reveal",
      reason: `3+ deliverables provide enough slots for entry prompts, shortlist highlights, and a closing winner announcement.`,
      confidence: "low",
    },
  ];
}

function scoreRolloutConfidence(input: {
  weekWeights: number[];
  briefText: string;
  objective?: string;
}): MediaPlanStrategySectionConfidence {
  if (!input.weekWeights.length) {
    return { level: "low", reason: "Week weights not yet defined" };
  }
  const hasObjective = Boolean(input.objective?.trim());
  const hasBriefSignal = Boolean(sanitizeBriefSignalText(input.briefText));
  if (hasObjective && hasBriefSignal) {
    return {
      level: "high",
      reason: `Grounded in ${input.weekWeights.length}-week weight distribution (${formatWeightDistribution(input.weekWeights)})`,
    };
  }
  if (hasObjective || hasBriefSignal) {
    return { level: "medium", reason: "Partial campaign context — weights drive rationale" };
  }
  return { level: "medium", reason: "Schedule weights only — brief signals limited" };
}

function scorePlatformConfidence(
  platformAllocation: Record<string, number>,
  platforms?: string[]
): MediaPlanStrategySectionConfidence {
  const ranked = sortedPlatforms(platformAllocation);
  if (ranked.length) {
    return {
      level: "high",
      reason: `Based on ${ranked.map((entry) => `${entry.percentage}% ${entry.platform}`).join(", ")} slot allocation`,
    };
  }
  if (platforms?.length) {
    return { level: "medium", reason: "Platform list confirmed — slot allocation pending" };
  }
  return { level: "low", reason: "Platform allocation not yet defined" };
}

function scoreCreatorMixConfidence(slate: SlateCreator[]): MediaPlanStrategySectionConfidence {
  if (!slate.length) {
    return { level: "low", reason: "Slate not confirmed" };
  }
  const counts = countTiers(slate);
  const classified = counts.mega + counts.macro + counts.mid + counts.micro + counts.nano;
  if (classified === slate.length) {
    return {
      level: "high",
      reason: `All ${slate.length} creators tier-classified (${formatTierCountSummary(counts)})`,
    };
  }
  return { level: "medium", reason: `${classified} of ${slate.length} creators tier-classified` };
}

function scoreWeeklyObjectivesConfidence(weekWeights: number[]): MediaPlanStrategySectionConfidence {
  if (!weekWeights.length) {
    return { level: "low", reason: "Week weights unavailable" };
  }
  return {
    level: "high",
    reason: `Derived from ${weekWeights.length}-week publishing weights`,
  };
}

function scoreCreativeConfidence(input: {
  briefText: string;
  slate: SlateCreator[];
  maxDeliverables: number;
}): { confidence: MediaPlanStrategySectionConfidence; limitations?: string } {
  const assets = detectCreativeAssetAvailability(input.briefText);
  const limitations: string[] = [];

  if (assets.songMentionedButUnknown) {
    limitations.push(
      "Creative execution will be finalised after reviewing the campaign song, lyrics, tempo, and mood."
    );
  }
  if (input.maxDeliverables <= 1) {
    limitations.push(
      `Slate deliverables average 1 post per creator — multi-part challenges and competitions are not recommended.`
    );
  }
  if (!input.slate.length) {
    return {
      confidence: { level: "low", reason: "No creator slate — deliverable counts unknown" },
      limitations: limitations.length ? limitations.join(" ") : undefined,
    };
  }
  if (assets.songMentionedButUnknown) {
    return {
      confidence: { level: "low", reason: "Song not yet provided" },
      limitations: limitations.join(" "),
    };
  }
  if (input.maxDeliverables <= 1) {
    return {
      confidence: { level: "medium", reason: "Single deliverable per creator limits format scope" },
      limitations: limitations.length ? limitations.join(" ") : undefined,
    };
  }
  if (assets.hasCreativeAssetDetails || assets.hasSongAsset) {
    return {
      confidence: { level: "high", reason: "Creative assets and deliverable counts confirmed" },
      limitations: limitations.length ? limitations.join(" ") : undefined,
    };
  }
  return {
    confidence: { level: "medium", reason: "Deliverable counts confirmed — creative asset details pending" },
    limitations: limitations.length ? limitations.join(" ") : undefined,
  };
}

/** Industry- and objective-aware creative format recommendations with reasons and deliverable guardrails. */
export function buildCreativeRecommendations(input: {
  briefText: string;
  objective?: string;
  industry?: string;
  platformAllocation: Record<string, number>;
  slate?: SlateCreator[];
}): MediaPlanCreativeRecommendation[] {
  const vertical = detectBriefVertical(input.briefText, input.industry);
  const industry = input.industry ?? detectIndustryFromBrief(input.briefText);
  const dominant = dominantPlatformName(input.platformAllocation);
  const dominantKey = dominant ? normalizePlatformKey(dominant) : "";
  const deliverables = slateDeliverableStats(input.slate ?? []);
  const maxDeliverables = deliverables.max || 1;
  const assets = detectCreativeAssetAvailability(input.briefText);

  const deliverableFormats = deliverableAwareFormats(maxDeliverables, vertical);
  const base: MediaPlanCreativeRecommendation[] = [...deliverableFormats];

  if (maxDeliverables >= 2 && (!assets.songMentionedButUnknown || assets.hasCreativeAssetDetails)) {
    const verticalFormats = [...VERTICAL_CREATIVE_FORMATS[vertical]];
    if (vertical === "general" && industry !== "general") {
      const industryVertical = industry as BriefVertical;
      if (industryVertical in VERTICAL_CREATIVE_FORMATS) {
        verticalFormats.push(...VERTICAL_CREATIVE_FORMATS[industryVertical].slice(0, 2));
      }
    }
    for (const entry of verticalFormats) {
      if (!isFormatAllowedForDeliverables(entry.format, maxDeliverables)) continue;
      if (assets.songMentionedButUnknown && HIGH_CONFIDENCE_FORMAT_PATTERNS.test(entry.format)) {
        continue;
      }
      base.push({
        ...entry,
        confidence: assets.songMentionedButUnknown ? "low" : "medium",
      });
    }
  }

  if (dominantKey.includes("tiktok") && maxDeliverables >= 2 && !assets.songMentionedButUnknown) {
    if (!base.some((entry) => /duet|stitch|challenge/i.test(entry.format))) {
      base.push({
        format: "Trend-jacking with native audio",
        reason: `TikTok carries ${sortedPlatforms(input.platformAllocation)[0]?.percentage ?? 0}% of slots — riding platform sounds compounds reach.`,
        confidence: "medium",
      });
    }
  }
  if (dominantKey.includes("instagram") && !base.some((entry) => /reels|stories/i.test(entry.format))) {
    base.push({
      format: "Reels-first visual storytelling",
      reason: `Instagram allocation prioritises Reels for discovery while Stories sustain daily touchpoints.`,
      confidence: "high",
    });
  }

  if (input.objective?.match(/awareness|reach/i)) {
    base.push({
      format: "Hook-first 3-second openers",
      reason: "Awareness objectives require stopping the scroll immediately — the first frame determines distribution.",
      confidence: "high",
    });
  }
  if (input.objective?.match(/engagement|ugc|community/i) && maxDeliverables >= 2) {
    base.push({
      format: "Participation prompts and CTA overlays",
      reason: "Engagement objectives need explicit invitations to comment, duet, or create response content.",
      confidence: maxDeliverables >= 3 ? "high" : "medium",
    });
  }

  const seen = new Set<string>();
  return base
    .filter((entry) => {
      const key = entry.format.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return isFormatAllowedForDeliverables(entry.format, maxDeliverables);
    })
    .slice(0, 6);
}

/** Creator-category-specific format recommendations. */
export function buildCreatorTypeRecommendations(input: {
  briefText: string;
  slate: SlateCreator[];
}): MediaPlanCreativeRecommendation[] {
  const categories = detectCreatorCategories(input.briefText, input.slate);
  const results: MediaPlanCreativeRecommendation[] = [];
  const seen = new Set<string>();

  for (const category of categories.slice(0, 4)) {
    for (const entry of CREATOR_CATEGORY_FORMATS[category]) {
      const key = entry.format.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        format: entry.format,
        reason: entry.reason,
      });
    }
  }

  return results.slice(0, 6);
}

/** Build the full strategy narrative from campaign inputs. */
export function buildMediaPlanStrategyNarrative(
  input: MediaPlanStrategyNarrativeInput
): MediaPlanStrategyNarrative {
  const industry =
    input.industry ?? detectIndustryFromBrief(input.briefText, input.objective);
  const evidence = extractMediaPlanStrategyEvidence(input);
  const deliverables = slateDeliverableStats(input.slate);
  const creativeScoring = scoreCreativeConfidence({
    briefText: input.briefText,
    slate: input.slate,
    maxDeliverables: deliverables.max,
  });

  const rolloutStrategy = buildRolloutStrategyNarrative({
    weekWeights: input.weekWeights,
    baselineWeights: input.baselineWeights,
    scheduleAdjusted: input.scheduleAdjusted,
    durationWeeks: input.durationWeeks,
    briefText: input.briefText,
    objective: input.objective,
  });

  const platformIntelligence = buildPlatformIntelligenceNarrative({
    platformAllocation: input.platformAllocation,
    briefText: input.briefText,
    audience: input.audience,
    platforms: input.platforms,
  });

  const creatorMixIntelligence = buildCreatorMixIntelligenceNarrative(input.slate);

  return {
    rolloutStrategy: evidence.weekWeightDistribution
      ? `${rolloutStrategy} Evidence: ${input.durationWeeks}-week flight · ${evidence.weekWeightDistribution}.`
      : rolloutStrategy,
    rolloutConfidence: scoreRolloutConfidence({
      weekWeights: input.weekWeights,
      briefText: input.briefText,
      objective: input.objective,
    }),
    platformIntelligence: evidence.platformAllocation.length
      ? `${platformIntelligence} Evidence: ${evidence.platformAllocation.map((entry) => `${entry.percentage}% ${entry.platform}`).join(", ")} of publishing slots.`
      : platformIntelligence,
    platformConfidence: scorePlatformConfidence(input.platformAllocation, input.platforms),
    creatorMixIntelligence: evidence.tierSummary
      ? `${creatorMixIntelligence} Evidence: ${evidence.totalCreators} creators · ${evidence.totalDeliverables} total deliverables.`
      : creatorMixIntelligence,
    creatorMixConfidence: scoreCreatorMixConfidence(input.slate),
    weeklyObjectives: buildWeeklyObjectives({
      weekWeights: input.weekWeights,
      briefText: input.briefText,
      objective: input.objective,
    }),
    weeklyObjectivesConfidence: scoreWeeklyObjectivesConfidence(input.weekWeights),
    creativeRecommendations: buildCreativeRecommendations({
      briefText: input.briefText,
      objective: input.objective,
      industry,
      platformAllocation: input.platformAllocation,
      slate: input.slate,
    }),
    creativeConfidence: creativeScoring.confidence,
    creativeLimitations: creativeScoring.limitations,
    creatorTypeRecommendations: buildCreatorTypeRecommendations({
      briefText: input.briefText,
      slate: input.slate,
    }),
    evidence,
  };
}

/** Convenience wrapper from a Campaign Object. */
export function buildMediaPlanStrategyNarrativeFromObject(
  campaignObject: CampaignObject,
  options: {
    weekWeights: number[];
    baselineWeights?: number[];
    scheduleAdjusted?: boolean;
    durationWeeks: number;
    platformAllocation: Record<string, number>;
    slate: SlateCreator[];
  }
): MediaPlanStrategyNarrative {
  const facts = getCampaignFacts(campaignObject);
  const briefText = resolveBriefTextForScheduling(campaignObject);

  return buildMediaPlanStrategyNarrative({
    weekWeights: options.weekWeights,
    baselineWeights: options.baselineWeights,
    scheduleAdjusted: options.scheduleAdjusted,
    durationWeeks: options.durationWeeks,
    platformAllocation: options.platformAllocation,
    slate: options.slate,
    briefText,
    objective: facts?.objective,
    audience: facts?.audience,
    industry: facts?.industry,
    platforms: facts?.platforms,
  });
}
