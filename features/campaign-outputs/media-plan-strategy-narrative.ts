import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import { normalizeInfluencerTier } from "@/lib/creators/influencer-tier";

import { parseAggregatedServiceLabel } from "./hydration/quotation-service-types";
import { isUgcServiceType } from "./media-plan-deliverable-classification";
import {
  resolveAllowedMechanics,
  mechanicAllowed,
  sanitizeMechanicReferences,
  type CampaignMechanic,
} from "./media-plan-mechanics-ssot";
import { classifyCampaignType, campaignTypeWeeklyPhase, type CampaignType } from "./campaign-type-classifier";
import { buildPlatformIntelligenceNarrative } from "./platform-intelligence";
import { resolveBriefTextForScheduling } from "./brief-media-plan-schedule";
import { detectWeightProfile } from "./media-plan-weight-profile";
import { mergePlatformAllocation } from "./platform-allocation";
import type { SlateCreator } from "./output-inputs";
import { buildMarketTimingRationale, buildMarketTimingCitations, type MarketTimingCitation } from "@/features/market-intelligence/market-timing-rationale";
import {
  buildSectionRationale,
  type MediaPlanSectionRationaleKey,
} from "./media-plan-section-rationale";
import {
  buildMarketSchedulingContext,
  resolveMarketIntelligenceConfig,
} from "@/features/market-intelligence";

function parseCampaignStartForMarket(iso?: string): Date {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-").map((part) => Number(part));
    if (year && month && day) {
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  now.setDate(now.getDate() + daysUntilMonday);
  now.setHours(12, 0, 0, 0);
  return now;
}

function resolveMarketContextForNarrative(
  input: MediaPlanStrategyNarrativeInput
): import("@/features/market-intelligence").MarketSchedulingContext | undefined {
  if (input.marketContext) return input.marketContext;
  if (!input.campaignObject && !input.campaignStartDate) return undefined;

  const start = parseCampaignStartForMarket(
    input.campaignStartDate ?? getCampaignFacts(input.campaignObject!)?.campaignStartDate
  );
  const config = input.campaignObject
    ? resolveMarketIntelligenceConfig(input.campaignObject, input.briefText)
    : resolveMarketIntelligenceConfig(
        { meta: {} } as import("@/features/campaign-intelligence").CampaignObject,
        input.briefText
      );

  return buildMarketSchedulingContext({
    campaignStartDate: start,
    durationWeeks: input.durationWeeks,
    config,
  });
}


export type StrategyConfidenceLevel = "low" | "medium" | "high";

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
  ugcCreatorCount: number;
  ugcDeliverableCount: number;
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
  /** Consumer purchase-cycle timing rationale — additive to rollout strategy. */
  marketTimingIntelligence?: string;
  marketTimingConfidence?: MediaPlanStrategySectionConfidence;
  /** Structured citations per market driver — rendered in Market Timing section. */
  marketTimingCitations?: MarketTimingCitation[];
  /** Expandable "Why?" bullets keyed by section — internal view only. */
  sectionRationale?: Partial<Record<MediaPlanSectionRationaleKey, string[]>>;
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
  /**
   * Calendar-derived display weights — SSOT for rollout bars and weekly objective %.
   * When omitted, brief weekWeights are used for display as well.
   */
  activityWeights?: number[];
  /** ISO campaign start date for market intelligence (YYYY-MM-DD). */
  campaignStartDate?: string;
  /** Pre-built market context — built from campaign object when omitted. */
  marketContext?: import("@/features/market-intelligence").MarketSchedulingContext;
  /** Campaign object for market config resolution when marketContext omitted. */
  campaignObject?: import("@/features/campaign-intelligence").CampaignObject;
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
  const normalized = normalizeInfluencerTier(tier);
  if (!normalized) return "unknown";
  switch (normalized) {
    case "Celebrity":
    case "Mega":
      return "mega";
    case "Macro":
      return "macro";
    case "Mid":
      return "mid";
    case "Micro":
      return "micro";
    case "Nano":
      return "nano";
    default:
      return "unknown";
  }
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

function serviceTypesForCreator(creator: SlateCreator): string[] {
  if (creator.serviceTypes?.length) return creator.serviceTypes;
  if (creator.serviceLabel?.trim()) {
    return parseAggregatedServiceLabel(creator.serviceLabel);
  }
  return [];
}

function creatorHasUgcDeliverable(creator: SlateCreator): boolean {
  return serviceTypesForCreator(creator).some((type) => isUgcServiceType(type, creator));
}

/** Creators with explicit UGC deliverables in the quotation — never inferred from tier or brief. */
export function countUgcCreators(slate: SlateCreator[]): number {
  return slate.filter(creatorHasUgcDeliverable).length;
}

/** UGC activation slots across the slate — quotation service labels containing UGC only. */
export function countUgcDeliverables(slate: SlateCreator[]): number {
  let total = 0;
  for (const creator of slate) {
    for (const type of serviceTypesForCreator(creator)) {
      if (isUgcServiceType(type, creator)) total += 1;
    }
  }
  return total;
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

export function sumTierCounts(counts: Record<CreatorTier, number>): number {
  return (
    (counts.mega ?? 0) +
    (counts.macro ?? 0) +
    (counts.mid ?? 0) +
    (counts.micro ?? 0) +
    (counts.nano ?? 0) +
    (counts.unknown ?? 0)
  );
}

export function formatTierCountSummary(counts: Record<CreatorTier, number>): string {
  const labels: Array<[CreatorTier, string]> = [
    ["mega", "Mega"],
    ["macro", "Macro"],
    ["mid", "Mid"],
    ["micro", "Micro"],
    ["nano", "Nano"],
    ["unknown", "Unclassified"],
  ];
  return labels
    .filter(([tier]) => (counts[tier] ?? 0) > 0)
    .map(([tier, label]) => `${counts[tier]} ${label}`)
    .join(", ");
}

export function formatCreatorMixCountSummary(
  counts: Record<CreatorTier, number>,
  ugcCreatorCount: number
): string {
  const parts = [formatTierCountSummary(counts)];
  if (ugcCreatorCount > 0) parts.push(`${ugcCreatorCount} UGC`);
  return parts.filter(Boolean).join(", ");
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
  const ugcCreatorCount = countUgcCreators(input.slate);
  const ugcDeliverableCount = countUgcDeliverables(input.slate);
  const deliverables = slateDeliverableStats(input.slate);
  const creativeAssets = detectCreativeAssetAvailability(input.briefText);

  return {
    durationWeeks: input.durationWeeks,
    weekWeightDistribution: formatWeightDistribution(input.activityWeights ?? input.weekWeights),
    platformAllocation: sortedPlatforms(input.platformAllocation),
    tierSummary: formatCreatorMixCountSummary(tierCounts, ugcCreatorCount),
    tierCounts,
    ugcCreatorCount,
    ugcDeliverableCount,
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
  const entries = Object.entries(mergePlatformAllocation(platformAllocation)).filter(
    ([, count]) => count > 0
  );
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
  slate?: SlateCreator[];
}): string {
  const { weekWeights, baselineWeights, scheduleAdjusted, briefText, objective, slate } = input;
  if (!weekWeights.length) return "";

  const allowedMechanics = resolveAllowedMechanics({ briefText, objective, slate });

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
      `A launch-weighted rollout (${distribution}) concentrates strategic emphasis in Week 1 (${first}%) — hero creators and awareness content lead while the campaign sustains meaningful activity across all ${weekWeights.length} weeks${objectiveHook}.`,
      `Publishing weight tilts toward the opening phase (${distribution}), with Week 1 carrying ${first}% emphasis — designed to spark awareness without compressing the full creator slate into a single week${objectiveHook}.`,
      `The activation opens with decisive launch emphasis (${distribution}): Week 1 leads at ${first}% weight while Weeks 2–${weekWeights.length} maintain brand presence through the full purchased duration${objectiveHook}.`,
    ];
    const middles = [
      `Weeks 2–${weekWeights.length} carry lighter emphasis (${weekWeights.slice(1).map((weight, index) => `W${index + 2} ${weight}%`).join(", ")}) but remain active publishing windows — sustaining visibility without oversaturating feeds.`,
      `Lighter weight in the back half keeps the story alive through earned conversation rather than abandoning the remaining campaign weeks.`,
      `Campaign weight signals launch priority, not early completion — creator activations continue through amplification, momentum, and close phases.`,
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
      mechanicAllowed(allowedMechanics, "ugc")
        ? `Early weeks seed curiosity and UGC participation; the back-loaded curve ensures the peak lands when the audience is primed to act.`
        : `Early weeks seed curiosity and audience familiarity; the back-loaded curve ensures the peak lands when the audience is primed to act.`,
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

export { buildPlatformIntelligenceNarrative } from "./platform-intelligence";

/** Creator tier mix rationale — tiers and UGC activations present in the slate, with exact counts. */
export function buildCreatorMixIntelligenceNarrative(slate: SlateCreator[]): string {
  const counts = countTiers(slate);
  const ugcCreators = countUgcCreators(slate);
  const ugcDeliverables = countUgcDeliverables(slate);
  const total = slate.length;
  if (!total) {
    return "Creator tier mix cannot be assessed reliably — the slate has no confirmed creators yet.";
  }

  const mixSummary = formatCreatorMixCountSummary(counts, ugcCreators);
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
      `${counts.nano} Nano add posting frequency and everyday authenticity — voices that keep the campaign active between hero moments`
    );
  }
  if (ugcCreators > 0) {
    const slotNote =
      ugcDeliverables > ugcCreators
        ? ` across ${ugcDeliverables} UGC activation${ugcDeliverables === 1 ? "" : "s"}`
        : "";
    parts.push(
      `${ugcCreators} UGC creator${ugcCreators === 1 ? "" : "s"}${slotNote} deliver participation-led, community-proof content — authentic responses and challenge formats granted as usage rights upon client request`
    );
  }

  return `The ${total}-creator slate (${mixSummary}) layers tiers by role: ${parts.join("; ")}.`;
}

/** Distinct phases for equal-weight trailing weeks after a launch-heavy W1. */
function deriveBurstTrailingPhase(position: number, totalTrailing: number): string {
  if (totalTrailing <= 1) return "Wrap-up";
  if (totalTrailing === 2) return position === 0 ? "Amplify" : "Wrap-up";
  if (totalTrailing === 3) {
    return (["Amplify", "Momentum", "Wrap-up"] as const)[position] ?? "Maintain";
  }
  if (position === totalTrailing - 1) return "Wrap-up";
  if (position === 0) return "Amplify";
  if (position === totalTrailing - 2) return "Momentum";
  return "Maintain";
}

function isBurstTrailingPattern(allWeights: number[], weekIndex: number): boolean {
  if (weekIndex <= 0 || allWeights.length < 2) return false;
  const firstWeight = allWeights[0] ?? 0;
  const trailing = allWeights.slice(1);
  if (!trailing.length) return false;
  const trailingWeight = trailing[0] ?? 0;
  const allTrailingEqual = trailing.every((weight) => weight === trailingWeight);
  const peakIndex = allWeights.indexOf(Math.max(...allWeights));
  return (
    peakIndex === 0 &&
    allTrailingEqual &&
    firstWeight > trailingWeight + 15
  );
}

/** Derive Launch / Amplify / Momentum / Maintain / Wrap-up from brief weekWeights — shared by rollout and weekly objectives. */
export function deriveMediaPlanWeekPhase(
  weight: number,
  weekIndex: number,
  totalWeeks: number,
  avgWeight: number,
  allWeights: number[]
): string {
  const spread = Math.max(...allWeights) - Math.min(...allWeights);
  const isFirst = weekIndex === 0;
  const isLast = weekIndex === totalWeeks - 1;

  if (isBurstTrailingPattern(allWeights, weekIndex)) {
    return deriveBurstTrailingPhase(weekIndex - 1, totalWeeks - 1);
  }

  if (spread <= 8) {
    return isLast && totalWeeks > 1 ? "Wrap-up" : "Maintain";
  }

  if (isLast) {
    if (weight >= avgWeight + 5) return "Wrap-up";
    return weight <= avgWeight - 8 ? "Maintain" : "Wrap-up";
  }

  if (weight >= avgWeight + 8) return isFirst ? "Launch" : "Amplify";
  if (weight <= avgWeight - 8) return "Maintain";
  if (isFirst && weight >= avgWeight + 5) return "Launch";
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
  allowedMechanics: Set<CampaignMechanic>;
}): string[] {
  const { phase, weekIndex, totalWeeks, briefText, objective, allowedMechanics } = input;
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
    const participationGoals: string[] = [];
    if (mechanicAllowed(allowedMechanics, "duet")) participationGoals.push("duets");
    if (mechanicAllowed(allowedMechanics, "stitch")) participationGoals.push("stitches");
    if (mechanicAllowed(allowedMechanics, "ugc")) participationGoals.push("UGC responses");
    if (participationGoals.length) {
      goals.push(`Encourage ${participationGoals.join(", ")}, comments, and audience participation`);
    } else {
      goals.push("Encourage comments, shares, and audience engagement with creator content");
    }
    if (
      mechanicAllowed(allowedMechanics, "ugc") &&
      objective?.match(/engagement|ugc|community/i)
    ) {
      goals.push("Convert passive viewers into active participants");
    }
    if (weekIndex === 1) {
      goals.push("Extend launch momentum with mid-tier creators and participation formats");
    }
  } else if (phase === "Momentum") {
    goals.push("Keep conversation flowing with varied creator perspectives");
    goals.push("Reinforce key messages without repeating Week 1 launch framing");
    if (vertical === "music") goals.push("Sustain track visibility through remixes, reactions, and creator interpretations");
    else if (vertical === "beauty") goals.push("Deepen product consideration through tutorials and routine integrations");
    else goals.push("Maintain category presence through authentic, non-repetitive storytelling");
  } else if (phase === "Maintain") {
    goals.push("Sustain category presence without oversaturating feeds");
    goals.push("Reinforce key messages through varied creator perspectives");
    if (vertical === "music") goals.push("Sustain track visibility through ongoing creator content");
    if (weekIndex === totalWeeks - 2 && totalWeeks > 2) {
      goals.push("Bridge mid-flight energy toward the campaign close");
    }
  } else if (phase === "Wrap-up") {
    goals.push("Concentrate energy on conversion and last-mile awareness");
    if (weekIndex === totalWeeks - 1) {
      goals.push("Close the flight with decisive calls-to-action and recap content");
    } else {
      goals.push("Build anticipation toward the campaign close");
    }
  }

  if (/\bpeak|hero|moment\b/i.test(briefText) && weekIndex === Math.floor(totalWeeks / 2)) {
    goals.push("Deliver the hero moment identified in the brief");
  }

  return goals.slice(0, 3);
}

/**
 * Per-week strategic objectives — display % from calendar activity weights when provided.
 * Brief weekWeights drive rollout narrative text; activityWeights drive card % and phases.
 */
export function buildWeeklyObjectives(input: {
  weekWeights: number[];
  activityWeights?: number[];
  briefText: string;
  objective?: string;
  industry?: string;
  slate?: SlateCreator[];
  campaignType?: CampaignType;
}): MediaPlanWeeklyObjective[] {
  const { weekWeights, activityWeights, briefText, objective, slate, industry } = input;
  if (!weekWeights.length) return [];

  const displayWeights =
    activityWeights?.length === weekWeights.length
      ? activityWeights
      : weekWeights;

  const classification = classifyCampaignType({ briefText, objective, industry });
  const campaignType = input.campaignType ?? classification.primary;

  const allowedMechanics = resolveAllowedMechanics({ briefText, objective, slate });
  const avgWeight =
    displayWeights.reduce((sum, weight) => sum + weight, 0) / displayWeights.length;

  return displayWeights.map((weight, index) => {
    const genericPhase = deriveMediaPlanWeekPhase(
      weight,
      index,
      displayWeights.length,
      avgWeight,
      displayWeights
    );
    const phase = campaignTypeWeeklyPhase(
      campaignType,
      genericPhase,
      index,
      displayWeights.length
    );
    return {
      week: index + 1,
      phase,
      weight,
      goals: goalsForWeek({
        phase: genericPhase,
        weekIndex: index,
        totalWeeks: displayWeights.length,
        weight,
        briefText,
        objective,
        allowedMechanics,
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
      format: "Creator-native storytelling",
      reason: "Authentic creator voice builds trust and encourages audience engagement.",
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

function formatRequiresMechanic(format: string): CampaignMechanic | null {
  if (/\bugc\b/i.test(format)) return "ugc";
  if (/\bduets?\b/i.test(format)) return "duet";
  if (/\bstitches?\b/i.test(format)) return "stitch";
  if (/\bchallenge|competition\b/i.test(format)) return "challenge";
  if (/\blive\b/i.test(format)) return "live";
  return null;
}

function isFormatAllowedForMechanics(format: string, allowed: Set<CampaignMechanic>): boolean {
  const mechanic = formatRequiresMechanic(format);
  if (!mechanic) return true;
  return mechanicAllowed(allowed, mechanic);
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

function strategyAwareFormats(input: {
  campaignType: import("./campaign-type-classifier").CampaignType;
  objective?: string;
  vertical: BriefVertical;
  maxDeliverables: number;
  allowedMechanics: Set<CampaignMechanic>;
}): MediaPlanCreativeRecommendation[] {
  const { campaignType, objective, vertical, maxDeliverables, allowedMechanics } = input;
  const objectiveLower = objective?.toLowerCase() ?? "";

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
    const secondPostFormat = mechanicAllowed(allowedMechanics, "challenge")
      ? "Post 2 — Participation or CTA"
      : "Post 2 — Conversion CTA";
    const secondPostReason = mechanicAllowed(allowedMechanics, "challenge")
      ? `Second deliverable converts awareness into action — explicit call-to-participate where brief signals participation.`
      : `Second deliverable converts awareness into action with a clear product or brand CTA.`;

    return [
      {
        format: "Post 1 — Intro / awareness hook",
        reason: `First of 2 deliverables establishes the narrative and primes the audience for the campaign objective.`,
        confidence: "high",
      },
      {
        format: secondPostFormat,
        reason: secondPostReason,
        confidence: "medium",
      },
      {
        format: "Sequential storytelling pair",
        reason: `Two posts allow a setup-and-payoff structure without requiring a full multi-week funnel.`,
        confidence: "high",
      },
    ];
  }

  const multiPostFormats: MediaPlanCreativeRecommendation[] = [
    {
      format: "Awareness → action → recap arc",
      reason: `With ${maxDeliverables}+ deliverables per creator, a narrative arc from intro through proof to closing CTA is viable.`,
      confidence: "medium",
    },
    {
      format: "Multi-part storytelling series",
      reason: `Multiple posts support escalating narrative formats — teaser, hero content, proof point, and finale.`,
      confidence: "medium",
    },
  ];

  if (mechanicAllowed(allowedMechanics, "challenge")) {
    multiPostFormats.push({
      format: "Participation-led content series",
      reason: `Brief or quotation signals participation mechanics — entry prompts and community response content fit the deliverable count.`,
      confidence: "medium",
    });
  }

  if (campaignType === "product_launch" || objectiveLower.includes("launch")) {
    multiPostFormats.push({
      format: "Launch reveal → demo → social proof",
      reason: "Product launch campaigns benefit from reveal, demonstration, and peer validation beats across multiple posts.",
      confidence: "high",
    });
  }

  if (campaignType === "brand_awareness" || objectiveLower.includes("awareness")) {
    multiPostFormats.push({
      format: "Hero moment → sustained visibility",
      reason: "Awareness campaigns front-load a hero post then sustain reach with supporting creator content.",
      confidence: "high",
    });
  }

  return multiPostFormats;
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
  const ugcCreators = countUgcCreators(slate);
  const classified = sumTierCounts(counts);
  const mixSummary = formatCreatorMixCountSummary(counts, ugcCreators);
  if (classified === slate.length) {
    return {
      level: "high",
      reason: `All ${slate.length} creators tier-classified${ugcCreators > 0 ? ` · ${ugcCreators} UGC` : ""} (${mixSummary})`,
    };
  }
  const classifiedNote = mixSummary || `${classified} of ${slate.length} creators tier-classified`;
  return {
    level: "medium",
    reason: ugcCreators > 0 ? `${classifiedNote} · ${ugcCreators} UGC` : classifiedNote,
  };
}

function scoreWeeklyObjectivesConfidence(
  displayWeights: number[]
): MediaPlanStrategySectionConfidence {
  if (!displayWeights.length) {
    return { level: "low", reason: "Week weights unavailable" };
  }
  return {
    level: "high",
    reason: `Derived from ${displayWeights.length}-week calendar creator distribution (${formatWeightDistribution(displayWeights)})`,
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
  const allowedMechanics = resolveAllowedMechanics({
    briefText: input.briefText,
    objective: input.objective,
    slate: input.slate,
  });

  const campaignClassification = classifyCampaignType({
    briefText: input.briefText,
    objective: input.objective,
    industry: input.industry ?? detectIndustryFromBrief(input.briefText),
  });

  const deliverableFormats = strategyAwareFormats({
    campaignType: campaignClassification.primary,
    objective: input.objective,
    vertical,
    maxDeliverables,
    allowedMechanics,
  }).filter((entry) => isFormatAllowedForMechanics(entry.format, allowedMechanics));
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
      if (!isFormatAllowedForMechanics(entry.format, allowedMechanics)) continue;
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
    const inviteParts = ["comment"];
    if (mechanicAllowed(allowedMechanics, "duet")) inviteParts.push("duet");
    if (mechanicAllowed(allowedMechanics, "ugc")) inviteParts.push("create response content");
    base.push({
      format: "Participation prompts and CTA overlays",
      reason: `Engagement objectives need explicit invitations to ${inviteParts.join(", ")}.`,
      confidence: maxDeliverables >= 3 ? "high" : "medium",
    });
  }

  const seen = new Set<string>();
  return base
    .filter((entry) => {
      const key = entry.format.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      const sanitizedReason = sanitizeMechanicReferences(entry.reason, allowedMechanics);
      entry.reason = sanitizedReason;
      return (
        isFormatAllowedForDeliverables(entry.format, maxDeliverables) &&
        isFormatAllowedForMechanics(entry.format, allowedMechanics)
      );
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

  const displayWeights = input.activityWeights ?? input.weekWeights;

  const rolloutStrategy = buildRolloutStrategyNarrative({
    weekWeights: input.weekWeights,
    baselineWeights: input.baselineWeights,
    scheduleAdjusted: input.scheduleAdjusted,
    durationWeeks: input.durationWeeks,
    briefText: input.briefText,
    objective: input.objective,
    slate: input.slate,
  });

  const platformIntelligence = buildPlatformIntelligenceNarrative({
    platformAllocation: input.platformAllocation,
    briefText: input.briefText,
    audience: input.audience,
    platforms: input.platforms,
  });

  const creatorMixIntelligence = buildCreatorMixIntelligenceNarrative(input.slate);

  const marketContext = resolveMarketContextForNarrative(input);

  const marketTimingIntelligence = marketContext
    ? buildMarketTimingRationale({
        context: marketContext,
        weekWeights: input.weekWeights,
        durationWeeks: input.durationWeeks,
        objective: input.objective,
      })
    : undefined;

  const marketTimingCitations = marketContext
    ? buildMarketTimingCitations({
        context: marketContext,
        weekWeights: input.weekWeights,
        durationWeeks: input.durationWeeks,
        objective: input.objective,
      })
    : undefined;

  const rationaleInput = {
    briefText: input.briefText,
    objective: input.objective,
    industry,
    weekWeights: input.weekWeights,
    activityWeights: input.activityWeights,
    platformAllocation: input.platformAllocation,
    slate: input.slate,
    marketContext,
    campaignStartDate: input.campaignStartDate,
  };

  const sectionRationale: Partial<Record<MediaPlanSectionRationaleKey, string[]>> = {
    platformAllocation: buildSectionRationale("platformAllocation", rationaleInput),
    weeklyObjectives: buildSectionRationale("weeklyObjectives", rationaleInput),
    creatorOrdering: buildSectionRationale("creatorOrdering", rationaleInput),
    marketTiming: buildSectionRationale("marketTiming", rationaleInput),
  };

  return {
    rolloutStrategy: evidence.weekWeightDistribution
      ? `${rolloutStrategy} Evidence: ${input.durationWeeks}-week flight · ${evidence.weekWeightDistribution}.`
      : rolloutStrategy,
    rolloutConfidence: scoreRolloutConfidence({
      weekWeights: input.weekWeights,
      briefText: input.briefText,
      objective: input.objective,
    }),
    platformIntelligence,
    platformConfidence: scorePlatformConfidence(input.platformAllocation, input.platforms),
    creatorMixIntelligence: evidence.tierSummary
      ? `${creatorMixIntelligence} Evidence: ${evidence.totalCreators} creators (${evidence.tierSummary}) · ${evidence.totalDeliverables} total deliverables${evidence.ugcDeliverableCount > 0 ? ` · ${evidence.ugcDeliverableCount} UGC activation${evidence.ugcDeliverableCount === 1 ? "" : "s"}` : ""}.`
      : creatorMixIntelligence,
    creatorMixConfidence: scoreCreatorMixConfidence(input.slate),
    weeklyObjectives: buildWeeklyObjectives({
      weekWeights: input.weekWeights,
      activityWeights: input.activityWeights,
      briefText: input.briefText,
      objective: input.objective,
      industry,
      slate: input.slate,
    }),
    weeklyObjectivesConfidence: scoreWeeklyObjectivesConfidence(displayWeights),
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
    marketTimingIntelligence,
    marketTimingCitations,
    marketTimingConfidence: marketContext
      ? {
          level: marketContext.windows.length ? "high" : "medium",
          reason: marketContext.windows.length
            ? `${marketContext.countries.join(", ")} calendar · ${marketContext.windows.length} active windows`
            : "Market enabled — no high-intent windows in flight dates",
        }
      : { level: "low", reason: "Campaign start or geography not configured" },
    sectionRationale,
    evidence,
  };
}

/** Convenience wrapper from a Campaign Object. */
export function buildMediaPlanStrategyNarrativeFromObject(
  campaignObject: CampaignObject,
  options: {
    weekWeights: number[];
    activityWeights?: number[];
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
    activityWeights: options.activityWeights,
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
    campaignStartDate: facts?.campaignStartDate,
    campaignObject,
  });
}
