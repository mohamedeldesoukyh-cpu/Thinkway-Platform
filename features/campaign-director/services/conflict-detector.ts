import type {
  CampaignStrategyDocument,
  DirectorChallenge,
  DirectorConflictType,
  DirectorSpecialistId,
  SpecialistOutput,
} from "../types";
import { validateBudgetTotals100 } from "./budget-rules";
import { buildDirectorBudgetFromStrategy } from "./budget-rules";
import { isInternalTimelinePhase } from "./timeline-rules";

export type ConflictDetectionInput = {
  strategy: CampaignStrategyDocument;
  outputs: SpecialistOutput[];
  briefText: string;
  timelineContent?: string;
  budgetContent?: string;
};

function challenge(
  conflictType: DirectorConflictType,
  description: string,
  affectedSections: string[],
  assignedTo: DirectorSpecialistId
): DirectorChallenge {
  return {
    id: `challenge_${conflictType}_${Date.now()}`,
    conflictType,
    description,
    affectedSections,
    assignedTo,
    resolutionStatus: "open",
  };
}

/** Detect contradictions across budget, timeline, creator, KPI, brand, platform dimensions. */
export function detectConflicts(input: ConflictDetectionInput): DirectorChallenge[] {
  const { strategy, outputs, briefText } = input;
  const challenges: DirectorChallenge[] = [];

  const budget = buildDirectorBudgetFromStrategy(strategy, briefText);
  if (!validateBudgetTotals100(budget.allocations)) {
    challenges.push(
      challenge(
        "budget_total",
        `Budget allocations sum to ${budget.allocations.reduce((s, a) => s + (a.percent ?? 0), 0).toFixed(1)}% — must be exactly 100%`,
        ["budget"],
        "finance"
      )
    );
  }

  const tierSum = strategy.creatorTierStrategy.reduce((s, t) => s + t.allocationPercent, 0);
  if (Math.abs(tierSum - 100) > 0.01) {
    challenges.push(
      challenge(
        "budget_creator_mix",
        `Creator tier mix sums to ${tierSum}% — must equal 100%`,
        ["creators", "budget"],
        "creator_intelligence"
      )
    );
  }

  const mediaOutput = outputs.find((o) => o.specialistId === "media_planner");
  const timelineText =
    input.timelineContent ??
    mediaOutput?.evidence.join("\n") ??
    "";

  if (timelineText) {
    const internalPhases = timelineText
      .split("\n")
      .filter((line) => isInternalTimelinePhase(line));
    if (internalPhases.length > 0 && mediaOutput?.status !== "revised" && mediaOutput?.status !== "approved") {
      challenges.push(
        challenge(
          "timeline_internal",
          `Timeline contains internal agency phases: ${internalPhases.slice(0, 2).join("; ")}`,
          ["timeline"],
          "media_planner"
        )
      );
    }
  }

  const duration = strategy.understanding.timeline?.durationWeeks;
  const weekCount = (timelineText.match(/week\s*\d/gi) ?? []).length;
  if (duration && weekCount > 0 && Math.abs(weekCount - duration) > 2 && mediaOutput?.status !== "revised" && mediaOutput?.status !== "approved") {
    challenges.push(
      challenge(
        "timeline_duration",
        `Timeline week count (${weekCount}) diverges from strategy duration (${duration} weeks)`,
        ["timeline", "strategy"],
        "media_planner"
      )
    );
  }

  const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
  const creatorFees = budget.allocations.find((a) => /creator/i.test(a.category));
  if (creatorOutput && creatorFees?.percent && /mega.*\d{2,}%/i.test(creatorOutput.what)) {
    const megaMatch = creatorOutput.what.match(/Mega\s*(\d+)%/i);
    if (megaMatch && parseInt(megaMatch[1], 10) > creatorFees.percent) {
      challenges.push(
        challenge(
          "creator_budget",
          "Creator mix mega-tier allocation exceeds budget creator fee headroom",
          ["creators", "budget"],
          "creator_intelligence"
        )
      );
    }
  }

  const performanceOutput = outputs.find((o) => o.specialistId === "performance");
  if (performanceOutput && strategy.understanding.kpis.length > 0) {
    const strategyKpis = strategy.understanding.kpis.map((k) => k.metric.toLowerCase());
    const outputKpis = performanceOutput.what.toLowerCase();
    const missingKpi = strategyKpis.some((k) => !outputKpis.includes(k.split(" ")[0]));
    if (missingKpi) {
      challenges.push(
        challenge(
          "kpi_strategy",
          "Performance specialist KPI output missing strategy-defined metrics",
          ["performance", "strategy"],
          "performance"
        )
      );
    }
  }

  if (strategy.understanding.platforms.length === 0) {
    challenges.push(
      challenge(
        "platform_mix",
        "No platforms defined in strategy — specialists cannot align content",
        ["strategy"],
        "strategy"
      )
    );
  }

  return challenges;
}

export function countOpenChallenges(challenges: DirectorChallenge[]): number {
  return challenges.filter((c) => c.resolutionStatus === "open").length;
}
