import type {
  CampaignStrategyDocument,
  CrossReviewFinding,
  DirectorSpecialistId,
  SpecialistOutput,
} from "../types";
import { validateBudgetTotals100, buildDirectorBudgetFromStrategy } from "./budget-rules";
import { isInternalTimelinePhase } from "./timeline-rules";

type CrossReviewRule = {
  id: string;
  reviewerId: DirectorSpecialistId;
  targetId: DirectorSpecialistId;
  check: (
    strategy: CampaignStrategyDocument,
    outputs: SpecialistOutput[],
    briefText: string,
    timelineContent?: string
  ) => CrossReviewFinding | null;
  isResolved: (
    strategy: CampaignStrategyDocument,
    outputs: SpecialistOutput[],
    briefText: string,
    timelineContent?: string
  ) => boolean;
};

function finding(
  id: string,
  reviewerId: DirectorSpecialistId,
  targetId: DirectorSpecialistId,
  issue: string,
  requiredRevision: string,
  severity: CrossReviewFinding["severity"] = "high"
): CrossReviewFinding {
  return { id, reviewerId, targetId, issue, requiredRevision, severity, resolved: false };
}

const CROSS_REVIEW_RULES: CrossReviewRule[] = [
  {
    id: "cr_finance_creator_budget",
    reviewerId: "finance",
    targetId: "creator_intelligence",
    check: (strategy, outputs, briefText) => {
      const budget = buildDirectorBudgetFromStrategy(strategy, briefText);
      const creatorFees = budget.allocations.find((a) => /creator/i.test(a.category));
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      if (!creatorFees?.percent || !creatorOutput) return null;

      const megaMatch = creatorOutput.what.match(/Mega\s*(\d+)%/i);
      const macroMatch = creatorOutput.what.match(/Macro\s*(\d+)%/i);
      const heavyTierShare =
        (megaMatch ? parseInt(megaMatch[1], 10) : 0) +
        (macroMatch ? parseInt(macroMatch[1], 10) : 0);

      const overagePct = heavyTierShare - creatorFees.percent;
      if (overagePct > 10) {
        return finding(
          "cr_finance_creator_budget",
          "finance",
          "creator_intelligence",
          `Creator tier mix exceeds budget headroom by ${overagePct}% — heavy-tier allocation unsustainable`,
          "Reduce macro/mega tier share or rebalance to micro/nano",
          "high"
        );
      }
      return null;
    },
    isResolved: (strategy, outputs, briefText) => {
      const budget = buildDirectorBudgetFromStrategy(strategy, briefText);
      const creatorFees = budget.allocations.find((a) => /creator/i.test(a.category));
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      if (!creatorFees?.percent || !creatorOutput) return true;

      const megaMatch = creatorOutput.what.match(/Mega\s*(\d+)%/i);
      const macroMatch = creatorOutput.what.match(/Macro\s*(\d+)%/i);
      const heavyTierShare =
        (megaMatch ? parseInt(megaMatch[1], 10) : 0) +
        (macroMatch ? parseInt(macroMatch[1], 10) : 0);

      return heavyTierShare <= creatorFees.percent + 10 || creatorOutput.status === "revised";
    },
  },
  {
    id: "cr_finance_ugc_macro_budget",
    reviewerId: "finance",
    targetId: "creator_intelligence",
    check: (strategy, outputs, briefText) => {
      if (!/ugc|user[- ]generated/i.test(strategy.understanding.objective + strategy.narrative)) {
        return null;
      }
      const budget = buildDirectorBudgetFromStrategy(strategy, briefText);
      const creatorFees = budget.allocations.find((a) => /creator/i.test(a.category));
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      if (!creatorFees?.percent || !creatorOutput || creatorOutput.status === "revised") return null;

      const macroMatch = creatorOutput.what.match(/Macro\s*(\d+)%/i);
      const macroPct = macroMatch ? parseInt(macroMatch[1], 10) : 0;
      const overagePct = macroPct + 15 - creatorFees.percent;

      if (macroPct > 30 && overagePct > 5) {
        return finding(
          "cr_finance_ugc_macro_budget",
          "finance",
          "creator_intelligence",
          `Creator Macro tier (${macroPct}%) exceeds budget headroom by ~${Math.round(overagePct)}% for UGC-first campaign`,
          "Reduce Macro tier share — shift to Micro/Nano for cost-efficient UGC production"
        );
      }
      return null;
    },
    isResolved: (_strategy, outputs) => {
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      return creatorOutput?.status === "revised" || creatorOutput?.status === "approved";
    },
  },
  {
    id: "cr_risk_category_sensitivity",
    reviewerId: "risk",
    targetId: "creator_intelligence",
    check: (strategy, outputs) => {
      const isSensitive = /baby|parent|health|diaper/i.test(
        strategy.understanding.industry ?? strategy.narrative
      );
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      const hasHeavyTier =
        creatorOutput && /macro\s*(3[5-9]|[4-9]\d)%/i.test(creatorOutput.what);

      if (
        isSensitive &&
        hasHeavyTier &&
        creatorOutput?.status !== "revised" &&
        creatorOutput?.status !== "approved"
      ) {
        return finding(
          "cr_risk_category_sensitivity",
          "risk",
          "creator_intelligence",
          "Category sensitivity — heavy Macro tier may include creators without verified parenting credentials",
          "Replace unverified Macro creators with Micro/Nano mom-creator specialists"
        );
      }
      return null;
    },
    isResolved: (_strategy, outputs) => {
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      return creatorOutput?.status === "revised" || creatorOutput?.status === "approved";
    },
  },
  {
    id: "cr_risk_alcohol_creators",
    reviewerId: "risk",
    targetId: "creator_intelligence",
    check: (strategy) => {
      const hasAlcoholRisk = strategy.understanding.risks.some((r) => /\balcohol\b/i.test(r));
      if (hasAlcoholRisk) {
        return finding(
          "cr_risk_alcohol_creators",
          "risk",
          "creator_intelligence",
          "Alcohol regulations require age-appropriate creator selection",
          "Replace creators under 21 or without age-verified audiences"
        );
      }
      return null;
    },
    isResolved: (_strategy, outputs) => {
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      return creatorOutput?.status === "revised" || creatorOutput?.status === "approved";
    },
  },
  {
    id: "cr_risk_competitor_exclusivity",
    reviewerId: "risk",
    targetId: "creator_intelligence",
    check: (strategy, outputs) => {
      const isBeverage = /beverage|cpg|fmcg|coca|cola|pepsi/i.test(
        strategy.understanding.industry ?? strategy.narrative
      );
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      const hasMegaTier = creatorOutput && /mega\s*\d+/i.test(creatorOutput.what);

      if (isBeverage && hasMegaTier && creatorOutput?.status !== "revised") {
        return finding(
          "cr_risk_competitor_exclusivity",
          "risk",
          "creator_intelligence",
          "Competitor exclusivity conflict — Mega-tier creators may have rival beverage contracts",
          "Replace Mega-tier creators with exclusivity-safe Macro/Micro alternatives"
        );
      }
      return null;
    },
    isResolved: (_strategy, outputs) => {
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      if (!creatorOutput) return true;
      return (
        creatorOutput.status === "revised" ||
        creatorOutput.status === "approved" ||
        !/mega\s*\d{2,}%/i.test(creatorOutput.what)
      );
    },
  },
  {
    id: "cr_performance_timeline_reach",
    reviewerId: "performance",
    targetId: "strategy",
    check: (strategy) => {
      const duration = strategy.understanding.timeline?.durationWeeks ?? 6;
      if (duration < 4 && /reach|awareness/i.test(strategy.understanding.objective)) {
        return finding(
          "cr_performance_timeline_reach",
          "performance",
          "strategy",
          `Timeline (${duration} weeks) may not hit reach KPI for awareness objective`,
          "Extend publishing window or increase creator tier reach allocation",
          "medium"
        );
      }
      return null;
    },
    isResolved: (strategy) => {
      const duration = strategy.understanding.timeline?.durationWeeks ?? 6;
      return duration >= 4 || !/reach|awareness/i.test(strategy.understanding.objective);
    },
  },
  {
    id: "cr_performance_posting_fatigue",
    reviewerId: "performance",
    targetId: "media_planner",
    check: (_strategy, outputs, _briefText, timelineContent) => {
      const mediaOutput = outputs.find((o) => o.specialistId === "media_planner");
      const timelineText = timelineContent ?? mediaOutput?.what ?? "";
      if (/fatigue|daily\s*post|3\+?\s*posts/i.test(timelineText) && mediaOutput?.status !== "revised") {
        return finding(
          "cr_performance_posting_fatigue",
          "performance",
          "media_planner",
          "Posting frequency may cause audience fatigue",
          "Adjust publishing cadence in timeline",
          "medium"
        );
      }
      return null;
    },
    isResolved: (_strategy, outputs) => {
      const mediaOutput = outputs.find((o) => o.specialistId === "media_planner");
      return mediaOutput?.status === "revised" || mediaOutput?.status === "approved";
    },
  },
  {
    id: "cr_creative_educational_mix",
    reviewerId: "creative",
    targetId: "creator_intelligence",
    check: (strategy, outputs) => {
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      if (
        /educational|ugc|authentic/i.test(strategy.narrative) &&
        strategy.creatorTierStrategy.some((t) => /mega/i.test(t.tier) && t.allocationPercent > 30) &&
        creatorOutput?.status !== "revised"
      ) {
        return finding(
          "cr_creative_educational_mix",
          "creative",
          "creator_intelligence",
          "Creator mix skewed to mega tier — may not produce educational/UGC content",
          "Shift allocation toward micro/nano for authentic educational formats",
          "medium"
        );
      }
      return null;
    },
    isResolved: (_strategy, outputs) => {
      const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
      return creatorOutput?.status === "revised" || creatorOutput?.status === "approved";
    },
  },
  {
    id: "cr_media_internal_timeline",
    reviewerId: "media_planner",
    targetId: "media_planner",
    check: (_strategy, outputs, _briefText, timelineContent) => {
      const timelineOutput = outputs.find((o) => o.specialistId === "media_planner");
      if (!timelineOutput) return null;

      const evidenceHasInternal = timelineOutput.evidence.some((e) => isInternalTimelinePhase(e));
      const contentHasInternal =
        timelineContent && isInternalTimelinePhase(timelineContent.split("\n")[0] ?? "");

      if ((evidenceHasInternal || contentHasInternal) && timelineOutput.status !== "revised") {
        return finding(
          "cr_media_internal_timeline",
          "media_planner",
          "media_planner",
          "Timeline contains internal agency phases",
          "Replace with client-facing phases only"
        );
      }
      return null;
    },
    isResolved: (_strategy, outputs, _briefText, timelineContent) => {
      const timelineOutput = outputs.find((o) => o.specialistId === "media_planner");
      if (!timelineOutput) return true;
      const evidenceHasInternal = timelineOutput.evidence.some((e) => isInternalTimelinePhase(e));
      const contentHasInternal =
        timelineContent &&
        timelineContent.split("\n").some((line) => isInternalTimelinePhase(line));
      return (
        timelineOutput.status === "revised" ||
        timelineOutput.status === "approved" ||
        (!evidenceHasInternal && !contentHasInternal)
      );
    },
  },
  {
    id: "cr_presentation_timeline_kpi",
    reviewerId: "presentation",
    targetId: "strategy",
    check: (strategy, outputs) => {
      const performance = outputs.find((o) => o.specialistId === "performance");
      const media = outputs.find((o) => o.specialistId === "media_planner");

      if (performance && media) {
        const reachKpi = strategy.understanding.kpis.find((k) => /reach/i.test(k.metric));
        const shortTimeline = (strategy.understanding.timeline?.durationWeeks ?? 6) < 5;
        if (reachKpi && shortTimeline && /Publishing/i.test(media.what)) {
          return finding(
            "cr_presentation_timeline_kpi",
            "presentation",
            "strategy",
            "Contradiction between Timeline duration and Reach KPI target",
            "Director must reopen strategy and timeline for alignment"
          );
        }
      }
      return null;
    },
    isResolved: (strategy) => (strategy.understanding.timeline?.durationWeeks ?? 6) >= 5,
  },
  {
    id: "cr_presentation_budget_total",
    reviewerId: "presentation",
    targetId: "finance",
    check: (strategy, _outputs, briefText) => {
      const budget = buildDirectorBudgetFromStrategy(strategy, briefText);
      if (!validateBudgetTotals100(budget.allocations)) {
        return finding(
          "cr_presentation_budget_total",
          "presentation",
          "finance",
          "Budget allocations do not sum to 100%",
          "Normalize budget allocation percents to exactly 100%"
        );
      }
      return null;
    },
    isResolved: (strategy, _outputs, briefText) => {
      const budget = buildDirectorBudgetFromStrategy(strategy, briefText);
      return validateBudgetTotals100(budget.allocations);
    },
  },
];

/** Run cross-review — every specialist reviews others per domain rules. */
export function runCrossReview(
  strategy: CampaignStrategyDocument,
  outputs: SpecialistOutput[],
  briefText: string,
  timelineContent?: string
): CrossReviewFinding[] {
  const findings: CrossReviewFinding[] = [];

  for (const rule of CROSS_REVIEW_RULES) {
    const result = rule.check(strategy, outputs, briefText, timelineContent);
    if (result) findings.push(result);
  }

  return findings;
}

/** Re-evaluate whether a prior finding is resolved after specialist revision. */
export function isCrossReviewFindingResolved(
  finding: CrossReviewFinding,
  strategy: CampaignStrategyDocument,
  outputs: SpecialistOutput[],
  briefText: string,
  timelineContent?: string
): boolean {
  const rule = CROSS_REVIEW_RULES.find((r) => r.id === finding.id);
  if (!rule) return true;
  return rule.isResolved(strategy, outputs, briefText, timelineContent);
}

export function refreshCrossReviewResolution(
  findings: CrossReviewFinding[],
  strategy: CampaignStrategyDocument,
  outputs: SpecialistOutput[],
  briefText: string,
  timelineContent?: string
): CrossReviewFinding[] {
  return findings.map((f) => ({
    ...f,
    resolved: isCrossReviewFindingResolved(f, strategy, outputs, briefText, timelineContent),
  }));
}

export function countOpenCrossReviewFindings(findings: CrossReviewFinding[]): number {
  return findings.filter((f) => !f.resolved).length;
}

export function getOpenCrossReviewFindings(
  strategy: CampaignStrategyDocument,
  outputs: SpecialistOutput[],
  briefText: string,
  timelineContent?: string
): CrossReviewFinding[] {
  return runCrossReview(strategy, outputs, briefText, timelineContent);
}
