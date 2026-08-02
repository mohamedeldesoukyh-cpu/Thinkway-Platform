/**
 * Studio × Enterprise Creator Intelligence — consume-only projection.
 *
 * Studio never owns intelligence. This maps canonical ECI bundles into
 * Studio planning display/ranking signals. Calculations remain in
 * `@/lib/enterprise-creator-intelligence`.
 *
 * Contract: docs/architecture/STUDIO_CAPABILITY_CONTRACT.md (Intelligence = consume only)
 */

import type { CreatorIntelligenceBundle } from "@/lib/enterprise-creator-intelligence";

/** Planning decision answers every recommendation must support. */
export type StudioPlanningDecision = {
  what: string;
  why: string;
  evidence: string;
  businessValue: string;
  alternative: string;
  /** Why this creator is not recommended (or caution). */
  whyNot: string;
};

/** Layer summaries for Creator Detail / Compare — projected from ECI, not recalculated. */
export type StudioEciLayerSummary = {
  investment: string;
  commercial: string;
  audience: string;
  performance: string;
  categoryBrand: string;
  historical: string;
};

/** Ephemeral Studio planning projection — never a parallel intelligence engine. */
export type StudioEciPlanningSignal = {
  influencerId: string;
  platform: string | null;
  /** Investment overall score (0–100) — Studio planning fit SSOT. */
  investmentScore: number | null;
  recommendation: string;
  /** Explainable business logic (why recommended). */
  why: string;
  /** Why not / caution for the planner. */
  whyNot: string;
  /** Business objective this creator supports. */
  businessObjectiveSupport: string;
  /** Commercial justification for boardroom use. */
  commercialJustification: string;
  commercialHealth: string;
  businessReadiness: string;
  evidence: string[];
  topStrengths: string[];
  risks: string[];
  alternatives: string[];
  expectedOutcomes: string[];
  confidencePercent: number | null;
  evidenceCoveragePercent: number | null;
  /** Executive-ready one-line summary for proposal/presentation. */
  executiveSummary: string;
  layers: StudioEciLayerSummary;
  decision: StudioPlanningDecision;
  /** Expected campaign contribution for presentation. */
  expectedCampaignContribution: string;
};

function clampScore(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function isNegativeRecommendation(label: string): boolean {
  return /high risk|insufficient|not recommended|avoid/i.test(label);
}

/**
 * Project one ECI bundle into a Studio planning signal.
 * Pure — no I/O, no recalculation of ECI layers.
 */
export function projectStudioEciPlanningSignal(
  bundle: CreatorIntelligenceBundle
): StudioEciPlanningSignal {
  const inv = bundle.investment;
  const commercial = bundle.commercial;
  const audience = bundle.audience;
  const performance = bundle.performance;
  const category = bundle.categoryBrand;
  const historical = bundle.historical;
  const score = clampScore(inv.overallScore);
  const recommendation = inv.recommendation.recommendation;

  const evidence = [
    ...(inv.recommendation.explainability.evidence ?? []).slice(0, 4),
    ...inv.dimensions
      .filter((d) => d.score != null)
      .sort((a, b) => (b.weightedContribution ?? 0) - (a.weightedContribution ?? 0))
      .slice(0, 3)
      .map((d) => `${d.label}: ${d.score}/100`),
  ].filter(Boolean);

  const commercialJustification =
    inv.recommendation.explainability.businessContext?.trim() ||
    [
      `Commercial health: ${commercial.commercialHealth.level}`,
      `Investment readiness: ${commercial.investmentReadiness.status}`,
    ]
      .filter(Boolean)
      .join(" · ");

  const risks = inv.risks.slice(0, 3).map((r) => `${r.label}: ${r.explanation}`);
  const alternatives = inv.opportunities
    .slice(0, 3)
    .map((o) => `${o.label}: ${o.explanation}`);
  const topStrengths =
    inv.aiHints.topStrengths?.slice(0, 3) ??
    inv.dimensions
      .filter((d) => d.score != null && d.score >= 70)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3)
      .map((d) => d.label);

  const why =
    inv.recommendation.why?.trim() ||
    inv.recommendation.explainability.reason?.trim() ||
    "Investment recommendation derived from Enterprise Creator Intelligence.";

  const whyNot = isNegativeRecommendation(recommendation)
    ? why
    : risks[0] ??
      (inv.recommendation.explainability.missingInputs?.[0]
        ? `Missing inputs: ${inv.recommendation.explainability.missingInputs.slice(0, 2).join(", ")}`
        : "No critical blockers identified — monitor commercial and delivery risks.");

  const businessObjectiveSupport =
    inv.businessReadiness.planningWorkspace?.trim() ||
    inv.businessReadiness.campaignWorkspace?.trim() ||
    (topStrengths[0]
      ? `Strongest planning signal: ${topStrengths[0]}.`
      : "Supports campaign planning objectives via investment readiness signals.");

  // Never surface internal scoreMeaning / machine shorthand as boardroom outcome.
  const isBoardroomOutcome = (line: string | null | undefined): line is string => {
    const trimmed = line?.trim() ?? "";
    if (!trimmed || trimmed.length < 12) return false;
    if (/weighted average of scored investment/i.test(trimmed)) return false;
    if (/^consider\b/i.test(trimmed) && /reuse creator investment/i.test(trimmed)) {
      return false;
    }
    if (/^ready$/i.test(trimmed)) return false;
    return true;
  };

  const expectedOutcomes = [
    inv.businessReadiness.campaignWorkspace,
    inv.businessReadiness.planningWorkspace,
    topStrengths[0]
      ? `Delivers ${topStrengths[0].toLowerCase()} support for the campaign objective.`
      : null,
    alternatives[0],
  ].filter(isBoardroomOutcome);

  const expectedCampaignContribution =
    expectedOutcomes[0] ||
    "Contributes reach and category-aligned content to the Planning Package.";

  const layers: StudioEciLayerSummary = {
    investment: [
      recommendation,
      score != null ? `${score}/100` : null,
      inv.recommendation.scoreMeaning,
    ]
      .filter(Boolean)
      .join(" · "),
    commercial: [
      `Health ${commercial.commercialHealth.level}`,
      `Readiness ${commercial.investmentReadiness.status}`,
      commercialJustification,
    ]
      .filter(Boolean)
      .join(" · "),
    audience: [
      audience.quality?.level ? `Quality ${audience.quality.level}` : null,
      audience.stability?.level ? `Stability ${audience.stability.level}` : null,
      `Evidence ${audience.evidenceCoverage?.percent ?? "—"}%`,
    ]
      .filter(Boolean)
      .join(" · "),
    performance: [
      performance.overallTrend ? `Trend ${performance.overallTrend}` : null,
      performance.trendExplanation?.businessImplication,
      `Evidence ${performance.evidenceCoverage?.percent ?? "—"}%`,
    ]
      .filter(Boolean)
      .join(" · "),
    categoryBrand: [
      category.specialisation?.level
        ? `Specialisation ${category.specialisation.level}`
        : null,
      category.specialisation?.meaning,
      category.businessReadiness?.primaryCategories?.[0]
        ? `Primary ${category.businessReadiness.primaryCategories[0]}`
        : null,
      `Evidence ${category.evidenceCoverage?.percent ?? "—"}%`,
    ]
      .filter(Boolean)
      .join(" · "),
    historical: [
      `${historical.months?.length ?? 0} months of Historical Intelligence`,
      `Evidence ${historical.evidenceCoverage?.percent ?? "—"}%`,
    ]
      .filter(Boolean)
      .join(" · "),
  };

  const decision: StudioPlanningDecision = {
    what: isNegativeRecommendation(recommendation)
      ? `Not Recommended for this campaign`
      : `Recommended for this campaign`,
    why,
    evidence: evidence.slice(0, 3).join("; ") || "Evidence coverage limited — strengthen planning inputs.",
    businessValue: businessObjectiveSupport,
    alternative: alternatives[0] ?? "Hold alternate creators for the same tier/objective.",
    whyNot,
  };

  const executiveSummary = [
    isNegativeRecommendation(recommendation) ? "Not Recommended" : "Recommended",
    inv.recommendation.scoreMeaning,
    inv.recommendation.confidence.percent != null
      ? `planning confidence signals present`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    influencerId: bundle.influencerId,
    platform: bundle.platform,
    investmentScore: score,
    recommendation,
    why,
    whyNot,
    businessObjectiveSupport,
    commercialJustification,
    commercialHealth: String(commercial.commercialHealth.level),
    businessReadiness: String(
      inv.businessReadiness.overall ?? commercial.investmentReadiness.status
    ),
    evidence,
    topStrengths,
    risks,
    alternatives,
    expectedOutcomes,
    confidencePercent: inv.recommendation.confidence.percent,
    evidenceCoveragePercent: inv.evidenceCoverage.percent,
    executiveSummary,
    layers,
    decision,
    expectedCampaignContribution,
  };
}

export function buildStudioEciSignalMap(
  bundles: CreatorIntelligenceBundle[]
): Map<string, StudioEciPlanningSignal> {
  const map = new Map<string, StudioEciPlanningSignal>();
  for (const bundle of bundles) {
    const signal = projectStudioEciPlanningSignal(bundle);
    map.set(signal.influencerId, signal);
    map.set(`inf:${signal.influencerId}`, signal);
  }
  return map;
}

/** Fit-score map for slate / campaign score consumers (ECI investment scores only). */
export function studioEciFitScoreRecord(
  signals: Map<string, StudioEciPlanningSignal>
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const [key, signal] of signals) {
    if (signal.investmentScore == null) continue;
    if (key.startsWith("inf:")) continue;
    record[signal.influencerId] = signal.investmentScore;
    record[`inf:${signal.influencerId}`] = signal.investmentScore;
  }
  return record;
}

export function lookupStudioEciSignal(
  signals: Map<string, StudioEciPlanningSignal> | undefined,
  creatorId: string
): StudioEciPlanningSignal | undefined {
  if (!signals?.size) return undefined;
  const raw = creatorId.trim();
  const bare = raw.replace(/^inf:/, "").replace(/^dis:/, "");
  return signals.get(raw) ?? signals.get(bare) ?? signals.get(`inf:${bare}`);
}

/** Boardroom-ready reason line from an ECI signal. */
export function formatStudioEciReason(signal: StudioEciPlanningSignal): string {
  // Lazy import pattern avoided — keep pure; executive wording inlined for reason strings.
  const negative = /high risk|insufficient|not recommended|avoid/i.test(signal.recommendation);
  const decision = negative ? "Not Recommended" : "Recommended";
  const parts = [
    `${decision} for this campaign`,
    signal.why,
    `Business value: ${signal.businessObjectiveSupport}`,
    `Commercial value: ${signal.commercialJustification}`,
  ].filter(Boolean);
  const evidence = signal.evidence.slice(0, 2).join("; ");
  if (evidence) parts.push(`Evidence: ${evidence}`);
  if (signal.risks[0]) parts.push(`Risk: ${signal.risks[0]}`);
  parts.push(`Alternative: ${signal.decision.alternative}`);
  parts.push(`Expected outcome: ${signal.expectedCampaignContribution}`);
  return parts.join(" — ");
}

