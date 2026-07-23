import type { MediaPlanStrategySummary } from "./media-plan-strategy-summary";
import type { MediaPlanCreativeConceptDisplay } from "./media-plan-creative-direction";
import type { InfluencerConcept } from "./influencer-concepts";
import type {
  MediaPlanCreativeRecommendation,
  MediaPlanStrategySectionConfidence,
  MediaPlanWeeklyObjective,
} from "./media-plan-strategy-narrative";
import type { MarketTimingCitation } from "@/features/market-intelligence/market-timing-rationale";
import type { MediaPlanSectionRationaleKey } from "./media-plan-section-rationale";
import {
  filterStrategyBlocksByPresentation,
  type MediaPlanPresentationConfig,
} from "./media-plan-presentation";

export type MediaPlanStrategyBlockKind =
  | "executive"
  | "objective"
  | "narrative"
  | "weekly-grid"
  | "creative-list"
  | "platform-bars"
  | "tier-chips";

export type MediaPlanStrategyBlock = {
  label: string;
  body: string;
  kind: MediaPlanStrategyBlockKind;
  confidence?: MediaPlanStrategySectionConfidence;
  limitations?: string;
  weeklyObjectives?: MediaPlanWeeklyObjective[];
  creativeItems?: MediaPlanCreativeRecommendation[];
  /** Full brief bilingual concepts — rendered in HTML/PPTX when present. */
  creativeConceptDisplays?: MediaPlanCreativeConceptDisplay[];
  /** Expandable influencer concepts — nested inside Creative Direction. */
  influencerConcepts?: InfluencerConcept[];
  tierChips?: Array<{ tier: string; count: number }>;
  platformBars?: Array<{ platform: string; percentage: number }>;
  /** Calendar display weights for rollout bar display. */
  weekWeights?: number[];
  evidence?: string[];
  /** Structured market timing citations — salary, Ramadan, retail peaks, etc. */
  marketTimingCitations?: MarketTimingCitation[];
  /** Expandable "Why?" bullets — internal view only. */
  rationale?: string[];
  rationaleKey?: MediaPlanSectionRationaleKey;
};

function tierChipsFromSummary(summary: MediaPlanStrategySummary): Array<{ tier: string; count: number }> {
  const counts = summary.narrative?.evidence.tierCounts ?? summary.planningTierCounts;
  if (!counts) return [];
  const order: Array<[keyof typeof counts, string]> = [
    ["mega", "Mega"],
    ["macro", "Macro"],
    ["mid", "Mid"],
    ["micro", "Micro"],
    ["nano", "Nano"],
    ["unknown", "Unclassified"],
  ];
  const chips = order
    .filter(([key]) => (counts[key] ?? 0) > 0)
    .map(([key, label]) => ({ tier: label, count: counts[key]! }));

  const ugcCount = summary.narrative?.evidence.ugcCreatorCount ?? 0;
  if (ugcCount > 0) {
    chips.push({ tier: "UGC", count: ugcCount });
  }

  return chips;
}

function platformBarsFromSummary(summary: MediaPlanStrategySummary): Array<{ platform: string; percentage: number }> {
  return (summary.narrative?.evidence.platformAllocation ?? []).map((entry) => ({
    platform: entry.platform,
    percentage: entry.percentage,
  }));
}

function executiveEvidence(summary: MediaPlanStrategySummary): string[] {
  const base = evidenceStrip(summary);
  const platforms =
    summary.narrative?.evidence.platformAllocation?.map(
      (entry) => `${entry.platform} ${entry.percentage}%`
    ) ?? [];
  return [...base.slice(0, 2), ...platforms].slice(0, 8);
}

function evidenceStrip(summary: MediaPlanStrategySummary): string[] {
  const evidence = summary.narrative?.evidence;
  if (!evidence) return [];
  const items = [
    `${evidence.durationWeeks}-week flight`,
    evidence.weekWeightDistribution,
    evidence.tierSummary ? `${evidence.totalCreators} creators (${evidence.tierSummary})` : null,
    evidence.totalDeliverables ? `${evidence.totalDeliverables} deliverables` : null,
    evidence.objective ? `Objective: ${evidence.objective}` : null,
  ].filter((item): item is string => Boolean(item));
  return items;
}

export type BuildMediaPlanStrategyBlocksOptions = {
  /** Omit confidence badges and internal scoring notes from client-facing exports. */
  clientFacing?: boolean;
  /** Section visibility and creative direction subsections. */
  presentation?: MediaPlanPresentationConfig;
};

/** Shared display blocks for preview, HTML, and PPTX strategy sections. */
export function buildMediaPlanStrategyBlocks(
  summary?: MediaPlanStrategySummary,
  options?: BuildMediaPlanStrategyBlocksOptions
): MediaPlanStrategyBlock[] {
  if (!summary?.hasContent) return [];

  const clientFacing = options?.clientFacing ?? false;

  const narrative = summary.narrative;
  const blocks: Array<MediaPlanStrategyBlock | null> = [
    summary.executiveSummary
      ? {
          label: "Executive Summary",
          body: summary.executiveSummary,
          kind: "executive",
          evidence: executiveEvidence(summary),
        }
      : null,
    summary.campaignOverview
      ? { label: "Campaign Overview", body: summary.campaignOverview, kind: "objective" }
      : null,
    summary.planningCreatorMix
      ? {
          label: "Creator Mix",
          body: summary.planningCreatorMix,
          kind: "tier-chips",
          tierChips: tierChipsFromSummary(summary),
        }
      : null,
    summary.objective
      ? { label: "Objective", body: summary.objective, kind: "objective" }
      : null,
    narrative?.rolloutStrategy
      ? {
          label: "Campaign Rollout Strategy",
          body: narrative.rolloutStrategy,
          kind: "narrative",
          confidence: narrative.rolloutConfidence,
          evidence: [narrative.evidence.weekWeightDistribution],
          weekWeights: summary.weekWeights,
          tierChips: tierChipsFromSummary(summary),
        }
      : summary.launchApproach
        ? { label: "Launch Approach", body: summary.launchApproach, kind: "narrative" }
        : null,
    narrative?.marketTimingIntelligence
      ? {
          label: "Market Timing Intelligence",
          body: narrative.marketTimingIntelligence,
          kind: "narrative",
          confidence: narrative.marketTimingConfidence,
          marketTimingCitations: narrative.marketTimingCitations,
          rationale: narrative.sectionRationale?.marketTiming,
          rationaleKey: "marketTiming",
        }
      : null,
    narrative?.platformIntelligence
      ? {
          label: "Platform Intelligence",
          body: narrative.platformIntelligence,
          kind: "narrative",
          confidence: narrative.platformConfidence,
          rationale: narrative.sectionRationale?.platformAllocation,
          rationaleKey: "platformAllocation",
        }
      : null,
    narrative?.creatorMixIntelligence
      ? {
          label: "Creator Mix Intelligence",
          body: narrative.creatorMixIntelligence,
          kind: "tier-chips",
          confidence: narrative.creatorMixConfidence,
          tierChips: tierChipsFromSummary(summary),
          rationale: narrative.sectionRationale?.creatorOrdering,
          rationaleKey: "creatorOrdering",
        }
      : null,
    narrative?.weeklyObjectives?.length
      ? {
          label: "Weekly Objectives",
          body: "",
          kind: "weekly-grid",
          confidence: narrative.weeklyObjectivesConfidence,
          weeklyObjectives: narrative.weeklyObjectives,
          rationale: narrative.sectionRationale?.weeklyObjectives,
          rationaleKey: "weeklyObjectives",
        }
      : summary.weekWeightRationale
        ? { label: "Publishing Rhythm", body: summary.weekWeightRationale, kind: "narrative" }
        : null,
    summary.creativeConcepts?.length
      ? {
          label: "Creative Direction",
          body: summary.creativeConcepts
            .map((concept) =>
              concept.source === "thinkway"
                ? `Thinkway Creative Recommendation — ${concept.english.conceptName}`
                : concept.english.conceptName
            )
            .join("\n"),
          kind: "creative-list",
          creativeConceptDisplays: summary.creativeConcepts,
          influencerConcepts: summary.influencerConcepts,
          creativeItems: summary.creativeConcepts.map((concept) => ({
            format:
              concept.source === "thinkway"
                ? `Thinkway Creative Recommendation — ${concept.english.conceptName}`
                : concept.english.conceptName,
            reason: concept.english.creativeIdea,
          })),
        }
      : narrative?.creativeRecommendations?.length
      ? {
          label: "Creative Recommendations",
          body: "",
          kind: "creative-list",
          confidence: narrative.creativeConfidence,
          limitations: narrative.creativeLimitations,
          creativeItems: narrative.creativeRecommendations,
        }
      : summary.creativeDirection?.length
        ? {
            label: "Creative Direction",
            body: summary.creativeDirection.map((theme) => `• ${theme}`).join("\n"),
            kind: "creative-list",
            influencerConcepts: summary.influencerConcepts,
            creativeItems: summary.creativeDirection.map((theme) => {
              const [format, reason] = theme.split(" — Reason: ");
              return { format: format?.replace(/^•\s*/, "") ?? theme, reason: reason ?? "" };
            }),
          }
        : summary.influencerConcepts?.length
          ? {
              label: "Creative Direction",
              body: "",
              kind: "creative-list",
              influencerConcepts: summary.influencerConcepts,
            }
          : null,
    narrative?.creatorTypeRecommendations?.length
      ? {
          label: "Creator-Type Content",
          body: "",
          kind: "creative-list",
          creativeItems: narrative.creatorTypeRecommendations,
        }
      : null,
  ];

  const result = blocks.filter(Boolean).map((block) => {
    if (!block) return block;
    let next = block;
    if (clientFacing) {
      const { confidence: _confidence, rationale: _rationale, rationaleKey: _rk, ...rest } = next;
      next = rest as MediaPlanStrategyBlock;
      if (rest.creativeItems?.length) {
        next = {
          ...rest,
          creativeItems: rest.creativeItems.map(({ confidence: _itemConfidence, ...item }) => item),
        } as MediaPlanStrategyBlock;
      }
    }
    if (options?.presentation?.mode === "standard" && next.creativeItems?.length) {
      next = {
        ...next,
        creativeItems: next.creativeItems.slice(0, 4),
      };
    }
    return next;
  }).filter(Boolean) as MediaPlanStrategyBlock[];

  return options?.presentation
    ? filterStrategyBlocksByPresentation(result, options.presentation)
    : result;
}
