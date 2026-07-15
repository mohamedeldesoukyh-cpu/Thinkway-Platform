import type { MediaPlanStrategySummary } from "./media-plan-strategy-summary";
import type {
  MediaPlanCreativeRecommendation,
  MediaPlanStrategySectionConfidence,
  MediaPlanWeeklyObjective,
} from "./media-plan-strategy-narrative";

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
  tierChips?: Array<{ tier: string; count: number }>;
  platformBars?: Array<{ platform: string; percentage: number }>;
  evidence?: string[];
};

function tierChipsFromSummary(summary: MediaPlanStrategySummary): Array<{ tier: string; count: number }> {
  const counts = summary.narrative?.evidence.tierCounts;
  if (!counts) return [];
  const order: Array<[keyof typeof counts, string]> = [
    ["mega", "Mega"],
    ["macro", "Macro"],
    ["mid", "Mid"],
    ["micro", "Micro"],
    ["nano", "Nano"],
  ];
  return order
    .filter(([key]) => (counts[key] ?? 0) > 0)
    .map(([key, label]) => ({ tier: label, count: counts[key]! }));
}

function platformBarsFromSummary(summary: MediaPlanStrategySummary): Array<{ platform: string; percentage: number }> {
  return (summary.narrative?.evidence.platformAllocation ?? []).map((entry) => ({
    platform: entry.platform,
    percentage: entry.percentage,
  }));
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

/** Shared display blocks for preview, HTML, and PPTX strategy sections. */
export function buildMediaPlanStrategyBlocks(
  summary?: MediaPlanStrategySummary
): MediaPlanStrategyBlock[] {
  if (!summary?.hasContent) return [];

  const narrative = summary.narrative;
  const sharedEvidence = evidenceStrip(summary);
  const blocks: Array<MediaPlanStrategyBlock | null> = [
    summary.executiveSummary
      ? {
          label: "Executive Summary",
          body: summary.executiveSummary,
          kind: "executive",
          evidence: sharedEvidence.slice(0, 3),
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
        }
      : summary.launchApproach
        ? { label: "Launch Approach", body: summary.launchApproach, kind: "narrative" }
        : null,
    narrative?.platformIntelligence
      ? {
          label: "Platform Intelligence",
          body: narrative.platformIntelligence,
          kind: "platform-bars",
          confidence: narrative.platformConfidence,
          platformBars: platformBarsFromSummary(summary),
        }
      : null,
    narrative?.creatorMixIntelligence
      ? {
          label: "Creator Mix Intelligence",
          body: narrative.creatorMixIntelligence,
          kind: "tier-chips",
          confidence: narrative.creatorMixConfidence,
          tierChips: tierChipsFromSummary(summary),
        }
      : null,
    narrative?.weeklyObjectives?.length
      ? {
          label: "Weekly Objectives",
          body: "",
          kind: "weekly-grid",
          confidence: narrative.weeklyObjectivesConfidence,
          weeklyObjectives: narrative.weeklyObjectives,
        }
      : summary.weekWeightRationale
        ? { label: "Publishing Rhythm", body: summary.weekWeightRationale, kind: "narrative" }
        : null,
    narrative?.creativeRecommendations?.length
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
            creativeItems: summary.creativeDirection.map((theme) => {
              const [format, reason] = theme.split(" — Reason: ");
              return { format: format?.replace(/^•\s*/, "") ?? theme, reason: reason ?? "" };
            }),
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

  return blocks.filter(Boolean) as MediaPlanStrategyBlock[];
}
