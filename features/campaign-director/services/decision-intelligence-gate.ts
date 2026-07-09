import type { Is1ReasoningBundle } from "@/features/campaign-intelligence/services/reasoning";
import type { BudgetSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "../types";
import { briefRequiresOptionalCategories, briefForbidsBudgetSplit, validateBudgetTotals100 } from "./budget-rules";

export type DecisionIntelligenceCheck = {
  id: string;
  passed: boolean;
  detail?: string;
};

export type DecisionIntelligenceGateResult = {
  passed: boolean;
  blockers: string[];
  checks: DecisionIntelligenceCheck[];
};

const IS2_FUNNEL_STAGES = [
  "database",
  "country",
  "category",
  "audience",
  "brand_safety",
  "engagement",
  "availability",
  "director_review",
  "approved",
];

function recordCheck(
  checks: DecisionIntelligenceCheck[],
  blockers: string[],
  id: string,
  passed: boolean,
  detail?: string
): void {
  checks.push({ id, passed, detail: passed ? undefined : detail });
  if (!passed && detail) blockers.push(detail);
  else if (!passed) blockers.push(`Decision intelligence check failed: ${id}`);
}

/** Verify evidence, alignment, and no fabrication before Director approval. */
export function evaluateDecisionIntelligenceGate(input: {
  facts: CampaignFacts;
  strategy: CampaignStrategyDocument;
  reasoning: Is1ReasoningBundle;
  budget: BudgetSectionData;
  briefText?: string;
}): DecisionIntelligenceGateResult {
  const checks: DecisionIntelligenceCheck[] = [];
  const blockers: string[] = [];
  const { facts, strategy, reasoning, budget } = input;
  const briefText = input.briefText ?? facts.rawBriefExcerpt ?? strategy.narrative;

  const exec = reasoning.executiveStrategy;
  recordCheck(
    checks,
    blockers,
    "executive_evidence",
    exec.evidence.length >= 3 && exec.confidenceLevel > 0,
    "Executive strategy requires ≥3 evidence citations and confidence level"
  );

  recordCheck(
    checks,
    blockers,
    "executive_is2_fields",
    Boolean(
      exec.marketingChallenge &&
        exec.audienceChallenge &&
        exec.risks?.length &&
        exec.successConditions?.length
    ),
    "Executive strategy missing marketing/audience challenge, risks, or success conditions"
  );

  const expectedWeeks =
    facts.durationWeeks ?? strategy.understanding.timeline?.durationWeeks ?? 6;
  const activationWeeks = reasoning.creatorActivationTimeline.activationWeeks.length;
  recordCheck(
    checks,
    blockers,
    "timeline_matches_duration",
    activationWeeks === expectedWeeks,
    `Creator activation timeline has ${activationWeeks} weeks; CampaignFacts requires ${expectedWeeks}`
  );

  recordCheck(
    checks,
    blockers,
    "reporting_outside_duration",
    reasoning.creatorActivationTimeline.reportingPhase.label.toLowerCase().includes("reporting"),
    "Reporting phase must be labeled separately from activation weeks"
  );

  const factsAmount = facts.budget?.amount;
  const budgetTotal = budget.total;
  const budgetAligned =
    factsAmount == null ||
    budgetTotal == null ||
    Math.abs(factsAmount - budgetTotal) < 1;
  recordCheck(
    checks,
    blockers,
    "budget_matches_facts",
    budgetAligned,
    factsAmount != null && budgetTotal != null
      ? `Budget total ${budgetTotal} does not match CampaignFacts ${factsAmount}`
      : "Budget total missing while CampaignFacts specifies amount"
  );

  recordCheck(
    checks,
    blockers,
    "budget_totals_100",
    validateBudgetTotals100(budget.allocations),
    "Budget allocations do not sum to 100%"
  );

  const creatorFeesLine = budget.allocations.find((a) => /creator\s*fees?/i.test(a.category));
  const optionalSplit = briefRequiresOptionalCategories(briefText, facts);
  const creatorFeesDominant = optionalSplit || (creatorFeesLine?.percent ?? 0) >= 95;
  recordCheck(
    checks,
    blockers,
    "budget_default_creator_fees",
    creatorFeesDominant,
    "Default budget must allocate 100% to creator fees unless brief requires production/split categories"
  );

  const forbidsSplit = briefForbidsBudgetSplit(briefText, facts);
  const hasSplitLines = budget.allocations.some(
    (line) => !/creator\s*fees?/i.test(line.category)
  );
  recordCheck(
    checks,
    blockers,
    "budget_no_unauthorized_split",
    !forbidsSplit || !hasSplitLines,
    "Brief forbids separate production/usage-rights lines but budget is split across categories"
  );

  const funnel = reasoning.vendorDiscoveryFunnel;
  recordCheck(
    checks,
    blockers,
    "funnel_is2_stages",
    IS2_FUNNEL_STAGES.every((id) => funnel.some((s) => s.id === id)),
    "Vendor discovery funnel missing IS-2 stage(s)"
  );

  const approvedStage = funnel.find((s) => s.id === "approved");
  const dbStage = funnel.find((s) => s.id === "database");
  const hasKnownCounts = (approvedStage?.count ?? 0) > 0;
  const noFabricatedBaseline = hasKnownCounts || (dbStage?.count ?? 0) === 0;
  recordCheck(
    checks,
    blockers,
    "funnel_no_fabricated_counts",
    noFabricatedBaseline,
    "Funnel must not fabricate database counts when search results are unknown"
  );

  recordCheck(
    checks,
    blockers,
    "kpi_reasoning_complete",
    reasoning.kpiForecast.kpis.length > 0 &&
      reasoning.kpiForecast.kpis.every(
        (k) => k.reason && k.dependencies?.length && k.risk && k.tradeoff && k.sensitivity
      ),
    "KPI reasoning missing reason, dependencies, risk, trade-off, or sensitivity"
  );

  const mixTiers = reasoning.creatorMix.tiers;
  recordCheck(
    checks,
    blockers,
    "creator_mix_reasoning",
    Boolean(reasoning.creatorMix.whyMix) &&
      mixTiers.length === strategy.creatorTierStrategy.length &&
      mixTiers.every(
        (t) =>
          t.whyThisTier &&
          t.ifTierChanged &&
          t.budgetImpact &&
          t.reachImpact &&
          t.erImpact &&
          t.rejectedAlternative
      ),
    "Creator mix reasoning missing whyMix, tier impacts, or rejected alternatives"
  );

  recordCheck(
    checks,
    blockers,
    "director_minutes_board_format",
    reasoning.directorDecisionMinutes.length >= 4 &&
      reasoning.directorDecisionMinutes.every(
        (m) => m.problem && m.decision && m.owner && m.impact && m.evidence
      ),
    "Director decision minutes missing board-format fields (problem, decision, owner, impact, evidence)"
  );

  const vendorJson = JSON.stringify(reasoning.vendorRecommendations);
  const fabricatesGender = /(?:male|female)\s+(?:audience|followers)/i.test(vendorJson);
  recordCheck(
    checks,
    blockers,
    "vendor_no_fabricated_demographics",
    !fabricatesGender,
    "Vendor recommendations must not fabricate gender or audience demographics"
  );

  const syntheticWithFakeCounts = /^\d+\s+creators removed/i.test(
    reasoning.vendorRecommendations.rejected
      .map((r) => r.whyRejected)
      .join(" ")
  );
  recordCheck(
    checks,
    blockers,
    "vendor_no_fabricated_rejection_counts",
    !syntheticWithFakeCounts,
    "Rejected vendor reasoning must not cite fabricated removal counts"
  );

  const factsObjective = (facts.objective ?? "").toLowerCase();
  const strategyObjective = strategy.understanding.objective.toLowerCase();
  const objectiveAligned =
    !factsObjective ||
    strategyObjective.includes(factsObjective.slice(0, 12)) ||
    factsObjective.includes(strategyObjective.slice(0, 12));
  recordCheck(
    checks,
    blockers,
    "objective_alignment",
    objectiveAligned,
    "Strategy objective contradicts CampaignFacts.objective"
  );

  return {
    passed: blockers.length === 0,
    blockers,
    checks,
  };
}
