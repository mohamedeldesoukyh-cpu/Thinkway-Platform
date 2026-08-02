/**
 * Decision Impact — planning explanation (not prediction / forecasting).
 *
 * Answers: "What happens if this decision changes?"
 * Never fabricates numbers. Never invents confidence.
 * Where historical evidence is insufficient, say so explicitly.
 */

import type { StudioEciPlanningSignal } from "./project-studio-eci-signal";
import {
  deriveStrategyConfidence,
  toCampaignDecisionLabel,
  type StrategyConfidenceLevel,
} from "./executive-planning-view";

export type DecisionChangeKind =
  | "replace_creator"
  | "remove_creator"
  | "increase_budget"
  | "reduce_budget"
  | "change_creator_mix"
  | "change_platform_allocation"
  | "change_tier_mix"
  | "adjust_kpis"
  | "change_commercial_allocation";

export const DECISION_CHANGE_LABELS: Record<DecisionChangeKind, string> = {
  replace_creator: "Replace creator",
  remove_creator: "Remove creator",
  increase_budget: "Increase budget",
  reduce_budget: "Reduce budget",
  change_creator_mix: "Change creator mix",
  change_platform_allocation: "Change platform allocation",
  change_tier_mix: "Change tier mix",
  adjust_kpis: "Adjust KPIs",
  change_commercial_allocation: "Change commercial allocation",
};

export type DecisionImpactAssessment = {
  change: DecisionChangeKind;
  label: string;
  /** True when ECI evidence is strong enough to explain directional impact. */
  evidenceSufficient: boolean;
  businessImpact: string;
  commercialImpact: string;
  campaignImpact: string;
  riskImpact: string;
  confidenceChange: string;
};

export type DecisionImpactBundle = {
  question: string;
  evidenceNote: string;
  assessments: DecisionImpactAssessment[];
};

const INSUFFICIENT =
  "Insufficient historical evidence to confidently estimate impact.";

function hasSufficientEvidence(signal: StudioEciPlanningSignal): boolean {
  const coverage = signal.evidenceCoveragePercent ?? 0;
  const conf = signal.confidencePercent ?? 0;
  const hasNarrative =
    Boolean(signal.why?.trim()) &&
    Boolean(signal.commercialJustification?.trim()) &&
    signal.evidence.length > 0;
  // Planning explanation threshold — not a forecast model.
  return hasNarrative && coverage >= 50 && conf >= 45;
}

function confidenceDirection(
  level: StrategyConfidenceLevel,
  toward: "higher" | "lower" | "mixed"
): string {
  if (toward === "higher") {
    return `Planning confidence may rise from ${level} if the change strengthens evidence-backed fit; do not treat this as a measured forecast.`;
  }
  if (toward === "lower") {
    return `Planning confidence may fall from ${level} if the change weakens evidence-backed fit; do not treat this as a measured forecast.`;
  }
  return `Planning confidence (${level}) may move either way depending on what replaces the current choice; evidence must be re-checked.`;
}

function explainChange(
  signal: StudioEciPlanningSignal,
  change: DecisionChangeKind,
  sufficient: boolean
): Omit<DecisionImpactAssessment, "change" | "label" | "evidenceSufficient"> {
  if (!sufficient) {
    return {
      businessImpact: INSUFFICIENT,
      commercialImpact: INSUFFICIENT,
      campaignImpact: INSUFFICIENT,
      riskImpact: INSUFFICIENT,
      confidenceChange: INSUFFICIENT,
    };
  }

  const decision = toCampaignDecisionLabel(signal.recommendation);
  const conf = deriveStrategyConfidence(signal);
  const recommended = decision === "Recommended";
  const risk = signal.risks[0] ?? "known delivery or commercial variance";
  const alt = signal.decision.alternative;
  const contribution = signal.expectedCampaignContribution;
  const commercial = signal.commercialJustification;
  const business = signal.businessObjectiveSupport;

  switch (change) {
    case "replace_creator":
      return {
        businessImpact: recommended
          ? `Replacing this creator would reopen the business case currently supported by: ${business}`
          : `Replacing this creator is consistent with the Not Recommended stance — seek a stronger business fit.`,
        commercialImpact: recommended
          ? `Commercial outlook currently rests on: ${commercial}. A replacement must clear the same commercial bar.`
          : `Commercial outlook is weak for this creator (${commercial}); replacement should improve commercial readiness.`,
        campaignImpact: recommended
          ? `Campaign contribution currently expected: ${contribution}. Replacement changes slate composition and must preserve objective coverage.`
          : `Removing a weak-fit creator and replacing them can restore campaign coherence if the alternate is evidence-backed.`,
        riskImpact: recommended
          ? `Replacement introduces transition risk while current risk notes include: ${risk}.`
          : `Replacement reduces exposure to: ${risk}.`,
        confidenceChange: confidenceDirection(conf.level, recommended ? "mixed" : "higher"),
      };
    case "remove_creator":
      return {
        businessImpact: recommended
          ? `Removing this creator weakens the business rationale currently tied to: ${business}`
          : `Removing this creator aligns with the Not Recommended decision and protects the business case.`,
        commercialImpact: recommended
          ? `Commercial allocation tied to this creator would need reassignment. Current outlook: ${commercial}`
          : `Removing reduces spend exposure against a weak commercial outlook.`,
        campaignImpact: recommended
          ? `Campaign contribution (${contribution}) would need to be covered by remaining slate or an alternate (${alt}).`
          : `Campaign impact of removal is limited because this creator is not a recommended pillar.`,
        riskImpact: recommended
          ? `Removal creates coverage risk unless ${alt} is activated.`
          : `Removal reduces risk exposure related to: ${risk}.`,
        confidenceChange: confidenceDirection(conf.level, recommended ? "lower" : "higher"),
      };
    case "increase_budget":
      return {
        businessImpact: recommended
          ? `Increasing budget behind this creator amplifies the business bet already supported by: ${business}`
          : `Increasing budget behind a Not Recommended creator raises business risk without clear evidence.`,
        commercialImpact: recommended
          ? `Higher budget increases commercial exposure; current outlook: ${commercial}`
          : `Increasing budget is not supported by the current commercial outlook.`,
        campaignImpact: recommended
          ? `More budget may expand role/waves for this creator, but scale effects are not quantified here.`
          : `Budget increase would not improve campaign quality if fit remains weak.`,
        riskImpact: recommended
          ? `Concentration risk rises if budget increases without preserving alternates (${alt}).`
          : `Budget increase magnifies risk: ${risk}.`,
        confidenceChange: confidenceDirection(conf.level, recommended ? "mixed" : "lower"),
      };
    case "reduce_budget":
      return {
        businessImpact: recommended
          ? `Reducing budget may constrain delivery against: ${business}`
          : `Reducing budget on a Not Recommended creator is consistent with protecting the business case.`,
        commercialImpact: recommended
          ? `Lower allocation may force scope cuts; commercial outlook remains: ${commercial}`
          : `Budget reduction limits commercial exposure appropriately.`,
        campaignImpact: recommended
          ? `Expected contribution (${contribution}) may be harder to sustain with less budget — re-check role and wave.`
          : `Campaign impact of reduction is limited for a non-recommended creator.`,
        riskImpact: recommended
          ? `Under-delivery risk rises if scope stays unchanged after a budget cut.`
          : `Risk generally decreases as spend behind a weak fit declines.`,
        confidenceChange: confidenceDirection(conf.level, recommended ? "lower" : "higher"),
      };
    case "change_creator_mix":
      return {
        businessImpact: `Changing mix shifts how creators collectively support: ${business}`,
        commercialImpact: `Commercial balance across the slate changes; this creator's outlook (${commercial}) must stay coherent with the new mix.`,
        campaignImpact: `Mix changes alter coverage of contribution (${contribution}) across waves and roles.`,
        riskImpact: `Mix changes can concentrate or dilute risk (${risk}) depending on who enters or exits.`,
        confidenceChange: confidenceDirection(conf.level, "mixed"),
      };
    case "change_platform_allocation":
      return {
        businessImpact: `Platform reallocation changes where the business objective is pursued for this creator.`,
        commercialImpact: `Platform shifts can change fee efficiency; current commercial outlook: ${commercial}`,
        campaignImpact: `Platform change affects content format and contribution pathway (${contribution}).`,
        riskImpact: `Platform unfamiliarity or weaker historical signals can elevate delivery risk.`,
        confidenceChange:
          signal.platform
            ? confidenceDirection(conf.level, "mixed")
            : INSUFFICIENT,
      };
    case "change_tier_mix":
      return {
        businessImpact: `Tier mix changes alter reach vs intimacy balance supporting: ${business}`,
        commercialImpact: `Tier shifts change fee structure and commercial efficiency expectations (${commercial}).`,
        campaignImpact: `Tier changes redistribute campaign contribution roles across the slate.`,
        riskImpact: `Over-indexing one tier can increase concentration risk (${risk}).`,
        confidenceChange: confidenceDirection(conf.level, "mixed"),
      };
    case "adjust_kpis":
      return {
        businessImpact: `KPI changes redefine success for the same creator decision (${decision}).`,
        commercialImpact: `Commercial spend may no longer map cleanly to the new KPI set without re-validation.`,
        campaignImpact: `Contribution framing (${contribution}) must be re-mapped to the adjusted KPIs.`,
        riskImpact: `Misaligned KPIs increase the chance of optimizing the wrong outcome.`,
        confidenceChange: confidenceDirection(conf.level, "mixed"),
      };
    case "change_commercial_allocation":
      return {
        businessImpact: `Commercial reallocation changes investment weight behind: ${business}`,
        commercialImpact: `Directly revises exposure against current outlook: ${commercial}`,
        campaignImpact: `Allocation changes can expand or shrink this creator's campaign role.`,
        riskImpact: recommended
          ? `Over-allocating without alternates (${alt}) increases concentration risk.`
          : `Allocating more commercial weight to a Not Recommended creator increases avoidable risk (${risk}).`,
        confidenceChange: confidenceDirection(
          conf.level,
          recommended ? "mixed" : "lower"
        ),
      };
  }
}

/**
 * Build Decision Impact explanations for a creator recommendation.
 * Planning explanation only — not a forecast engine.
 */
export function buildDecisionImpactBundle(
  signal: StudioEciPlanningSignal,
  changes: DecisionChangeKind[] = [
    "replace_creator",
    "remove_creator",
    "increase_budget",
    "reduce_budget",
    "change_creator_mix",
    "change_platform_allocation",
    "change_tier_mix",
    "adjust_kpis",
    "change_commercial_allocation",
  ]
): DecisionImpactBundle {
  const sufficient = hasSufficientEvidence(signal);
  const assessments: DecisionImpactAssessment[] = changes.map((change) => {
    const explained = explainChange(signal, change, sufficient);
    return {
      change,
      label: DECISION_CHANGE_LABELS[change],
      evidenceSufficient: sufficient,
      ...explained,
    };
  });

  return {
    question: "What happens if this decision changes?",
    evidenceNote: sufficient
      ? "Directional planning explanation based on available Enterprise Creator Intelligence evidence — not a numeric forecast."
      : INSUFFICIENT,
    assessments,
  };
}

/** Compact Decision Impact lines for cards / proposal / presentation. */
export function formatDecisionImpactSummary(signal: StudioEciPlanningSignal): string {
  const bundle = buildDecisionImpactBundle(signal, [
    "replace_creator",
    "remove_creator",
    "change_commercial_allocation",
  ]);
  if (!bundle.assessments.some((a) => a.evidenceSufficient)) {
    return `${bundle.question} ${INSUFFICIENT}`;
  }
  return [
    bundle.question,
    ...bundle.assessments.map(
      (a) =>
        `${a.label}: business — ${a.businessImpact}; commercial — ${a.commercialImpact}; confidence — ${a.confidenceChange}`
    ),
  ].join(" | ");
}
