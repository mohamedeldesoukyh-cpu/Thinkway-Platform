/**
 * Canonical Recommendation Narrative — Final Product Excellence Pass
 *
 * One decision story for every Studio planning surface.
 * Decision transparency (alternatives + trade-offs) — not scenario planning.
 * Never invents unsupported evidence.
 */

import {
  buildDecisionImpactBundle,
  formatDecisionImpactSummary,
  type DecisionImpactBundle,
} from "./decision-impact";
import {
  deriveStrategyConfidence,
  toCampaignDecisionLabel,
  type CampaignDecisionLabel,
  type StrategyConfidence,
} from "./strategy-confidence";
import type { StudioEciPlanningSignal } from "./project-studio-eci-signal";

export const INSUFFICIENT_EVIDENCE = "Insufficient evidence available.";

/** Canonical narrative steps — same order on every surface. */
export const RECOMMENDATION_NARRATIVE_STEPS = [
  "recommendation",
  "why",
  "evidence",
  "businessValue",
  "commercialValue",
  "risk",
  "alternative",
  "decisionImpact",
  "confidence",
] as const;

export type RecommendationNarrativeStep = (typeof RECOMMENDATION_NARRATIVE_STEPS)[number];

export type PlanningAlternative = {
  option: string;
  whyNotSelected: string;
};

export type PlanningAlternatives = {
  recommendedOption: string;
  whyRecommended: string;
  alternatives: PlanningAlternative[];
  tradeOffs: string;
  decisionImpactSummary: string;
};

/**
 * Full recommendation quality checklist (10 answers).
 * Any unsupported field must be INSUFFICIENT_EVIDENCE.
 */
export type RecommendationNarrative = {
  decision: CampaignDecisionLabel;
  /** 1. What do we recommend? */
  what: string;
  /** 2. Why is this the best option? */
  whyBest: string;
  /** 3. What evidence supports this? */
  evidence: string;
  /** 4. What commercial value does it create? */
  commercialValue: string;
  /** 5. What business objective does it support? */
  businessObjective: string;
  /** 6. What risks exist? */
  risks: string;
  /** 7. What alternative was considered? */
  alternativeConsidered: string;
  /** 8. Why was that alternative not selected? */
  whyAlternativeNotSelected: string;
  /** 9. What happens if we change this decision? */
  decisionImpactSummary: string;
  decisionImpact: DecisionImpactBundle;
  /** 10. How confident are we? */
  confidence: StrategyConfidence;
  confidenceStatement: string;
  /** Decision transparency block */
  alternatives: PlanningAlternatives;
  /** Ordered steps for consistent UI */
  steps: Array<{ key: RecommendationNarrativeStep; label: string; body: string }>;
};

function textOrInsufficient(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return INSUFFICIENT_EVIDENCE;
  if (/^n\/?a$/i.test(trimmed) || /^unknown$/i.test(trimmed) || /^—$/.test(trimmed)) {
    return INSUFFICIENT_EVIDENCE;
  }
  return trimmed;
}

function hasEvidenceSupport(signal: StudioEciPlanningSignal): boolean {
  return (
    (signal.evidenceCoveragePercent ?? 0) >= 40 &&
    (signal.confidencePercent ?? 0) >= 35 &&
    signal.evidence.length > 0
  );
}

function buildWhyAlternativeNotSelected(
  signal: StudioEciPlanningSignal,
  decision: CampaignDecisionLabel
): string {
  const alt = signal.decision.alternative?.trim() || signal.alternatives[0]?.trim();
  if (!alt) return INSUFFICIENT_EVIDENCE;

  if (decision === "Recommended") {
    const why = signal.why?.trim();
    if (!why) return INSUFFICIENT_EVIDENCE;
    return `Not selected as the primary option because the recommended path is preferred for this campaign: ${why}`;
  }

  const whyNot = signal.whyNot?.trim() || signal.why?.trim();
  if (!whyNot) return INSUFFICIENT_EVIDENCE;
  return `Alternate path preferred — this creator is Not Recommended: ${whyNot}`;
}

function buildTradeOffs(signal: StudioEciPlanningSignal, decision: CampaignDecisionLabel): string {
  if (!hasEvidenceSupport(signal)) {
    return INSUFFICIENT_EVIDENCE;
  }

  const business = signal.businessObjectiveSupport?.trim();
  const commercial = signal.commercialJustification?.trim();
  const risk = signal.risks[0]?.trim() || signal.whyNot?.trim();
  const alt = signal.decision.alternative?.trim() || signal.alternatives[0]?.trim();
  const contribution = signal.expectedCampaignContribution?.trim();

  if (decision === "Recommended") {
    if (!business && !commercial && !risk && !alt) return INSUFFICIENT_EVIDENCE;
    return [
      business || commercial
        ? `Choosing the recommended option prioritizes ${[business, commercial].filter(Boolean).join(" and ")}.`
        : null,
      risk || alt
        ? `Trade-off: accepting ${risk || INSUFFICIENT_EVIDENCE} versus keeping only the alternate (${alt || INSUFFICIENT_EVIDENCE}).`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (!risk && !contribution && !alt) return INSUFFICIENT_EVIDENCE;
  return [
    risk ? `Not selecting this creator protects the campaign from ${risk}.` : null,
    alt || contribution
      ? `Trade-off: forgoing residual contribution (${contribution || INSUFFICIENT_EVIDENCE}) in favor of ${alt || "a stronger alternate"}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Build the canonical recommendation narrative for one creator / planning choice.
 */
export function buildRecommendationNarrative(
  signal: StudioEciPlanningSignal,
  displayName?: string
): RecommendationNarrative {
  const decision = toCampaignDecisionLabel(signal.recommendation);
  const confidence = deriveStrategyConfidence(signal);
  const name = displayName?.trim() || "This creator";
  const evidenceOk = hasEvidenceSupport(signal);

  const what =
    decision === "Recommended"
      ? `Recommended Option: include ${name} in the Planning Package for this campaign.`
      : `Not Recommended: do not prioritize ${name} for this campaign.`;

  const whyBest = textOrInsufficient(
    decision === "Recommended"
      ? signal.why
      : signal.whyNot || signal.why
  );

  const evidence = evidenceOk
    ? textOrInsufficient(signal.evidence.slice(0, 3).join("; "))
    : INSUFFICIENT_EVIDENCE;

  const commercialValue = textOrInsufficient(signal.commercialJustification);
  const businessObjective = textOrInsufficient(signal.businessObjectiveSupport);
  const risks = textOrInsufficient(
    signal.risks.slice(0, 2).join(" · ") || signal.whyNot
  );
  const alternativeConsidered = textOrInsufficient(
    signal.decision.alternative || signal.alternatives[0]
  );
  const whyAlternativeNotSelected = buildWhyAlternativeNotSelected(signal, decision);
  const decisionImpact = buildDecisionImpactBundle(signal);
  const decisionImpactSummary = formatDecisionImpactSummary(signal);

  const confidenceStatement = evidenceOk
    ? `${confidence.level} planning confidence — ${confidence.why}`
    : `${confidence.level} planning confidence — ${INSUFFICIENT_EVIDENCE} ${confidence.why}`;

  const alternatives: PlanningAlternatives = {
    recommendedOption:
      decision === "Recommended"
        ? `${name} — Recommended for this campaign`
        : `Do not select ${name}; pursue the alternate path`,
    whyRecommended: whyBest,
    alternatives: [
      {
        option: alternativeConsidered,
        whyNotSelected: whyAlternativeNotSelected,
      },
      ...(signal.alternatives.slice(1, 3).map((option) => ({
        option: textOrInsufficient(option),
        whyNotSelected: whyAlternativeNotSelected,
      })) || []),
    ].filter((a) => a.option !== INSUFFICIENT_EVIDENCE || a.whyNotSelected !== INSUFFICIENT_EVIDENCE),
    tradeOffs: buildTradeOffs(signal, decision),
    decisionImpactSummary,
  };

  // Ensure at least one alternative entry exists for decision transparency.
  if (alternatives.alternatives.length === 0) {
    alternatives.alternatives = [
      {
        option: INSUFFICIENT_EVIDENCE,
        whyNotSelected: INSUFFICIENT_EVIDENCE,
      },
    ];
  }

  const steps: RecommendationNarrative["steps"] = [
    { key: "recommendation", label: "Recommendation", body: what },
    { key: "why", label: "Why", body: whyBest },
    { key: "evidence", label: "Evidence", body: evidence },
    { key: "businessValue", label: "Business value", body: businessObjective },
    { key: "commercialValue", label: "Commercial value", body: commercialValue },
    { key: "risk", label: "Risk", body: risks },
    {
      key: "alternative",
      label: "Alternative",
      body: `${alternativeConsidered} — ${whyAlternativeNotSelected}`,
    },
    { key: "decisionImpact", label: "Decision impact", body: decisionImpactSummary },
    { key: "confidence", label: "Confidence", body: confidenceStatement },
  ];

  return {
    decision,
    what,
    whyBest,
    evidence,
    commercialValue,
    businessObjective,
    risks,
    alternativeConsidered,
    whyAlternativeNotSelected,
    decisionImpactSummary,
    decisionImpact,
    confidence,
    confidenceStatement,
    alternatives,
    steps,
  };
}

/** Compact quality check — true when narrative has explanation, alternative, and impact. */
export function assertRecommendationNarrativeComplete(
  narrative: RecommendationNarrative
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!narrative.what?.trim()) missing.push("what");
  if (!narrative.whyBest?.trim()) missing.push("why");
  if (!narrative.alternativeConsidered?.trim()) missing.push("alternative");
  if (!narrative.decisionImpactSummary?.trim()) missing.push("decisionImpact");
  if (!narrative.confidenceStatement?.trim()) missing.push("confidence");
  // Incomplete is allowed only when explicitly insufficient — never empty.
  for (const step of narrative.steps) {
    if (!step.body?.trim()) missing.push(step.key);
  }
  return { ok: missing.length === 0, missing };
}
