/**
 * Executive Planning View — Product Excellence Pass
 *
 * Transforms ECI planning signals into Strategy Director language.
 * Does not recalculate intelligence. Does not change ECI architecture.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveCreatorMix } from "@/features/campaign-studio/services/section-data-resolver";

import {
  formatDecisionImpactSummary,
  type DecisionImpactBundle,
} from "./decision-impact";
import {
  buildRecommendationNarrative,
  INSUFFICIENT_EVIDENCE,
  type RecommendationNarrative,
} from "./recommendation-narrative";
import type { StudioEciPlanningSignal } from "./project-studio-eci-signal";
import {
  deriveStrategyConfidence,
  toCampaignDecisionLabel,
  type CampaignDecisionLabel,
  type StrategyConfidence,
  type StrategyConfidenceLevel,
} from "./strategy-confidence";

export type { CampaignDecisionLabel, StrategyConfidence, StrategyConfidenceLevel };
export { deriveStrategyConfidence, toCampaignDecisionLabel };

/** Card-facing executive view — decision first, metrics last. */
export type ExecutiveCreatorCardView = {
  decision: CampaignDecisionLabel;
  /** 3–4 short executive bullets under the decision. */
  bullets: string[];
  strategyConfidence: StrategyConfidence;
  /** Full explainability when expanded. */
  explain: {
    shouldDoThis: string;
    why: string;
    businessValue: string;
    commercialValue: string;
    evidence: string;
    risks: string;
    alternatives: string;
    expectedOutcome: string;
  };
  /** Planning explanation — what happens if the decision changes. */
  decisionImpact: DecisionImpactBundle;
  /** Canonical 10-point narrative — SSOT for all surfaces. */
  narrative: RecommendationNarrative;
};

export type ExecutiveCreatorDetailView = {
  executiveRecommendation: string;
  whyThisCreator: string;
  businessValue: string;
  commercialOpportunity: string;
  campaignContribution: string;
  potentialRisks: string;
  alternativeCreators: string;
  historicalEvidence: string;
  strategyConfidence: StrategyConfidence;
  decisionImpact: DecisionImpactBundle;
  narrative: RecommendationNarrative;
  detailedIntelligence: {
    investmentMeaning: string;
    commercialMeaning: string;
    audienceMeaning: string;
    performanceMeaning: string;
    categoryBrandMeaning: string;
  };
};

export type StudioExecutivePlanningSummary = {
  campaignObjective: string;
  recommendedStrategy: string;
  recommendedCreatorMix: string;
  commercialOutlook: string;
  businessRisks: string;
  expectedBusinessResults: string;
  planningConfidence: StrategyConfidence;
  /** Decision transparency for the slate-level recommendation. */
  recommendedOption: string;
  alternativeOption: string;
  whyAlternativeNotSelected: string;
  tradeOffs: string;
  decisionImpactSummary: string;
};

function executiveBullets(signal: StudioEciPlanningSignal, decision: CampaignDecisionLabel): string[] {
  if (decision === "Not Recommended") {
    return [
      signal.whyNot.split(":")[0]?.trim() || "Does not meet campaign standards",
      signal.risks[0]?.split(":")[0]?.trim() || "Elevated planning risk",
      /cost|price|commercial|cpm|fee/i.test(signal.commercialJustification)
        ? "Commercial cost concern"
        : "Commercial outlook weak",
      deriveStrategyConfidence(signal).level === "Low"
        ? "Low planning confidence"
        : "Evidence does not support selection",
    ].slice(0, 4);
  }

  const category =
    signal.layers.categoryBrand.match(/Primary\s+([^·]+)/i)?.[1]?.trim() ||
    signal.topStrengths[0] ||
    "Category-aligned specialist";
  const audience =
    /audience|match|quality|stability/i.test(signal.why) || signal.layers.audience
      ? "Strong audience fit for this campaign"
      : "Audience fit supported";
  const commercial = /strong|healthy|ready|efficient/i.test(signal.commercialHealth + signal.commercialJustification)
    ? "Strong commercial value"
    : "Acceptable commercial outlook";
  const confidence = `${deriveStrategyConfidence(signal).level} planning confidence`;

  return [category, audience, commercial, confidence].slice(0, 4);
}

/**
 * Card executive view — Recommended / Not Recommended + short reasons.
 */
export function toExecutiveCreatorCardView(
  signal: StudioEciPlanningSignal,
  displayName?: string
): ExecutiveCreatorCardView {
  const narrative = buildRecommendationNarrative(signal, displayName);
  const decision = narrative.decision;
  const strategyConfidence = narrative.confidence;
  return {
    decision,
    bullets: executiveBullets(signal, decision),
    strategyConfidence,
    explain: {
      shouldDoThis:
        decision === "Recommended"
          ? `Yes — include this creator in the Planning Package for this campaign.`
          : `No — do not prioritize this creator for this campaign.`,
      why: narrative.whyBest,
      businessValue: narrative.businessObjective,
      commercialValue: narrative.commercialValue,
      evidence: narrative.evidence,
      risks: narrative.risks,
      alternatives: `${narrative.alternativeConsidered} — ${narrative.whyAlternativeNotSelected}`,
      expectedOutcome:
        signal.expectedCampaignContribution?.trim() || INSUFFICIENT_EVIDENCE,
    },
    decisionImpact: narrative.decisionImpact,
    narrative,
  };
}

export function toExecutiveCreatorDetailView(
  signal: StudioEciPlanningSignal,
  displayName?: string
): ExecutiveCreatorDetailView {
  const card = toExecutiveCreatorCardView(signal, displayName);
  const n = card.narrative;
  return {
    executiveRecommendation: n.what,
    whyThisCreator: n.whyBest,
    businessValue: n.businessObjective,
    commercialOpportunity: n.commercialValue,
    campaignContribution:
      signal.expectedCampaignContribution?.trim() || INSUFFICIENT_EVIDENCE,
    potentialRisks: n.risks,
    alternativeCreators: `${n.alternativeConsidered} — ${n.whyAlternativeNotSelected}`,
    historicalEvidence: signal.layers.historical?.trim() || INSUFFICIENT_EVIDENCE,
    strategyConfidence: card.strategyConfidence,
    decisionImpact: card.decisionImpact,
    narrative: n,
    detailedIntelligence: {
      investmentMeaning: `Planning recommendation: ${signal.recommendation}. ${signal.decision.what} — readiness to put budget behind this creator for the campaign objective.`,
      commercialMeaning: `Commercial outlook: ${signal.commercialHealth}. ${n.commercialValue}`,
      audienceMeaning: `Audience implication: ${signal.layers.audience || INSUFFICIENT_EVIDENCE}`,
      performanceMeaning: `Delivery outlook: ${signal.layers.performance || INSUFFICIENT_EVIDENCE}`,
      categoryBrandMeaning: `Category & brand fit: ${signal.layers.categoryBrand || INSUFFICIENT_EVIDENCE}`,
    },
  };
}

/** Proposal block — canonical recommendation narrative (planning logic, not metrics). */
export function formatExecutiveProposalCreatorBlock(
  signal: StudioEciPlanningSignal,
  displayName: string
): {
  businessRecommendation: string;
  commercialRecommendation: string;
  campaignContribution: string;
  expectedKpiContribution: string;
  expectedAudienceContribution: string;
  riskMitigation: string;
  alternativeConsidered: string;
  reasonAlternativeNotSelected: string;
  decisionImpact: string;
  tradeOffs: string;
  confidence: string;
  narrative: string;
  /** Ordered steps for export surfaces. */
  steps: RecommendationNarrative["steps"];
} {
  const n = buildRecommendationNarrative(signal, displayName);
  const campaignContribution =
    signal.expectedCampaignContribution?.trim() || INSUFFICIENT_EVIDENCE;
  const expectedKpiContribution =
    signal.expectedOutcomes[0]?.trim() || INSUFFICIENT_EVIDENCE;
  const expectedAudienceContribution =
    signal.layers.audience?.trim() || INSUFFICIENT_EVIDENCE;
  const riskMitigation =
    n.risks === INSUFFICIENT_EVIDENCE
      ? INSUFFICIENT_EVIDENCE
      : `Mitigate by monitoring ${n.risks.split(":")[0]}; keep an alternate ready.`;

  const narrative = n.steps.map((step) => `${step.label}: ${step.body}`).join(" → ");

  return {
    businessRecommendation: n.what,
    commercialRecommendation: n.commercialValue,
    campaignContribution,
    expectedKpiContribution,
    expectedAudienceContribution,
    riskMitigation,
    alternativeConsidered: n.alternativeConsidered,
    reasonAlternativeNotSelected: n.whyAlternativeNotSelected,
    decisionImpact: n.decisionImpactSummary,
    tradeOffs: n.alternatives.tradeOffs,
    confidence: n.confidenceStatement,
    narrative,
    steps: n.steps,
  };
}

/** Presentation decision chain — same narrative order as every Studio surface. */
export function formatExecutivePresentationChain(signal: StudioEciPlanningSignal): string {
  const n = buildRecommendationNarrative(signal);
  return n.steps.map((step) => `${step.label}: ${step.body}`).join(" → ");
}

/**
 * Studio Executive Summary — always producible from Campaign Object (+ optional ECI signals).
 * Does not change section order in Strategy Engine; enhances the existing Executive Summary surface.
 */
export function buildStudioExecutivePlanningSummary(
  campaignObject: CampaignObject,
  signals?: StudioEciPlanningSignal[]
): StudioExecutivePlanningSummary {
  const facts = getCampaignFacts(campaignObject);
  const creators = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const mix = resolveCreatorMix(campaignObject);
  const mixLine =
    mix.length > 0
      ? mix.map((t) => `${t.count ?? "—"} ${t.tier}`).join(", ")
      : `${creators.recommendations?.creatorIds?.length ?? 0} creators on the planning slate`;

  const recommended = (signals ?? []).filter(
    (s) => toCampaignDecisionLabel(s.recommendation) === "Recommended"
  );
  const notRecommended = (signals ?? []).filter(
    (s) => toCampaignDecisionLabel(s.recommendation) === "Not Recommended"
  );

  const avgCoverage =
    signals && signals.length > 0
      ? Math.round(
          signals.reduce((sum, s) => sum + (s.evidenceCoveragePercent ?? 0), 0) / signals.length
        )
      : 0;
  const avgConf =
    signals && signals.length > 0
      ? Math.round(
          signals.reduce((sum, s) => sum + (s.confidencePercent ?? 0), 0) / signals.length
        )
      : avgCoverage;
  const blended = Math.round(avgCoverage * 0.55 + avgConf * 0.45);
  let level: StrategyConfidenceLevel = "Low";
  if (blended >= 85) level = "Very High";
  else if (blended >= 70) level = "High";
  else if (blended >= 50) level = "Moderate";
  if (!signals?.length) level = creators.recommendations?.creatorIds?.length ? "Moderate" : "Low";

  const strategyText =
    typeof campaignObject.sections.strategy.content === "string"
      ? campaignObject.sections.strategy.content.trim().slice(0, 280)
      : "";

  const primary = recommended[0] ?? signals?.[0];
  const primaryNarrative = primary
    ? buildRecommendationNarrative(primary)
    : null;

  const recommendedStrategy =
    strategyText ||
    (recommended.length > 0
      ? `Advance ${recommended.length} recommended creator${recommended.length === 1 ? "" : "s"} into the Planning Package with clear commercial and audience rationale.`
      : "Build a category-aligned creator mix that supports the campaign objective with evidence-backed selections.");

  const recommendedOption =
    primaryNarrative?.alternatives.recommendedOption ||
    (recommended.length > 0
      ? `Advance ${recommended.length} recommended creator${recommended.length === 1 ? "" : "s"} on the planning slate`
      : INSUFFICIENT_EVIDENCE);

  const alternativeOption =
    primaryNarrative?.alternativeConsidered ||
    (notRecommended.length > 0
      ? `Hold or replace ${notRecommended.length} weak-fit creator${notRecommended.length === 1 ? "" : "s"}`
      : INSUFFICIENT_EVIDENCE);

  const whyAlternativeNotSelected =
    primaryNarrative?.whyAlternativeNotSelected || INSUFFICIENT_EVIDENCE;

  const tradeOffs = primaryNarrative?.alternatives.tradeOffs || INSUFFICIENT_EVIDENCE;

  const decisionImpactSummary =
    primaryNarrative?.decisionImpactSummary ||
    (signals && signals.length > 0
      ? formatDecisionImpactSummary(signals[0]!)
      : INSUFFICIENT_EVIDENCE);

  return {
    campaignObjective:
      facts?.objective?.trim() ||
      "Deliver an explainable, commercially justified creator campaign for the brand objective.",
    recommendedStrategy,
    recommendedCreatorMix: mixLine,
    commercialOutlook:
      primaryNarrative?.commercialValue ||
      recommended[0]?.commercialJustification ||
      INSUFFICIENT_EVIDENCE,
    businessRisks:
      primaryNarrative?.risks ||
      (notRecommended.length > 0
        ? `Avoid ${notRecommended.length} weak-fit creator${notRecommended.length === 1 ? "" : "s"}; ${recommended[0]?.risks[0] ?? "monitor delivery and commercial variance."}`
        : recommended[0]?.risks[0] || INSUFFICIENT_EVIDENCE),
    expectedBusinessResults:
      recommended[0]?.expectedCampaignContribution ||
      facts?.kpis?.slice(0, 3).join(", ") ||
      INSUFFICIENT_EVIDENCE,
    planningConfidence: {
      level,
      why:
        level === "Very High" || level === "High"
          ? `Planning confidence is ${level.toLowerCase()} based on Enterprise Creator Intelligence coverage across the slate and clarity of the campaign objective.`
          : `Planning confidence is ${level.toLowerCase()} — strengthen evidence coverage and confirm commercial inputs before boardroom sign-off.`,
      evidenceSupports:
        signals && signals.length > 0
          ? `ECI signals available for ${signals.length} creator${signals.length === 1 ? "" : "s"}; average evidence coverage ${avgCoverage}%.`
          : INSUFFICIENT_EVIDENCE,
      assumptions: "Assumes brief, budget, and market inputs remain stable through presentation.",
      whatCouldReduce: "Budget cuts, audience mismatch, or missing commercial history would reduce confidence.",
    },
    recommendedOption,
    alternativeOption,
    whyAlternativeNotSelected,
    tradeOffs,
    decisionImpactSummary,
  };
}

/** Pick a final recommendation among compared creators. */
export function pickStrategyCompareFinal(
  columns: Array<{ id: string; displayName: string; signal: StudioEciPlanningSignal | null }>
): {
  winnerId: string | null;
  winnerName: string | null;
  why: string;
  confidence: StrategyConfidenceLevel;
} {
  const scored = columns
    .filter((c) => c.signal)
    .map((c) => {
      const s = c.signal!;
      const decision = toCampaignDecisionLabel(s.recommendation);
      const conf = deriveStrategyConfidence(s);
      const rank =
        (decision === "Recommended" ? 1000 : 0) +
        (s.investmentScore ?? 0) +
        (s.evidenceCoveragePercent ?? 0) * 0.25;
      return { ...c, decision, conf, rank };
    })
    .sort((a, b) => b.rank - a.rank);

  const winner = scored[0];
  if (!winner?.signal) {
    return {
      winnerId: null,
      winnerName: null,
      why: "Insufficient Enterprise Creator Intelligence to declare a final recommendation.",
      confidence: "Low",
    };
  }

  const runner = scored[1];
  return {
    winnerId: winner.id,
    winnerName: winner.displayName,
    why: `${winner.displayName} is the stronger choice for this campaign: ${winner.signal.why}${
      runner
        ? ` Compared with ${runner.displayName}, this option offers better business and commercial impact for the stated objective.`
        : ""
    }`,
    confidence: winner.conf.level,
  };
}
