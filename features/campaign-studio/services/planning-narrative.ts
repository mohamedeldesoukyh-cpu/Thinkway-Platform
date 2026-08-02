/**
 * Enterprise Planning Package — Planning Narrative SSOT
 *
 * One continuous executive business story for Studio.
 * Executive Planning Brief, Proposal, Presentation, and Approval Package
 * all consume this narrative. Planner edits Campaign Object once; deliverables align.
 *
 * Does not persist as a new entity. Does not touch Strategy Engine / Planning Context.
 * Derives from Campaign Object + optional ECI signals only.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import {
  buildRecommendationNarrative,
  INSUFFICIENT_EVIDENCE,
} from "./eci/recommendation-narrative";
import {
  buildStudioExecutivePlanningSummary,
  toCampaignDecisionLabel,
  type StrategyConfidence,
  type StudioExecutivePlanningSummary,
} from "./eci/executive-planning-view";
import type { StudioEciPlanningSignal } from "./eci/project-studio-eci-signal";
import { toBoardroomLanguage } from "./boardroom-language";
import {
  resolveBudgetData,
  resolveCampaignSummary,
  resolveCreatorMix,
  resolveExecutiveStrategy,
  resolveExecutiveStrategyReasoning,
  resolveGroundedStrategyFields,
  resolveTimelineData,
} from "./section-data-resolver";

export const PLANNING_NARRATIVE_LABEL = "Enterprise Planning Package";

/** Ordered spine — every deliverable follows this story. */
export const PLANNING_NARRATIVE_SPINE = [
  "planningRequest",
  "businessChallenge",
  "strategicInsight",
  "recommendedBusinessDecision",
  "campaignStrategy",
  "creatorStrategy",
  "commercialStrategy",
  "executionStrategy",
  "expectedBusinessOutcome",
  "assumptions",
  "openDecisions",
  "executiveRecommendation",
] as const;

export type PlanningNarrativeSpineKey = (typeof PLANNING_NARRATIVE_SPINE)[number];

export type PlanningAssumption = {
  category:
    | "Budget"
    | "Audience"
    | "Market"
    | "Platform"
    | "Historical evidence"
    | "Commercial"
    | "Other";
  statement: string;
};

export type OpenDecision = {
  decision: string;
  ownerHint: string;
};

/** Executive concern — planning observation, never framed as a blocker. */
export type ExecutiveObjection = {
  concern: string;
  observation: string;
};

export type CriticalSuccessFactor = {
  factor: string;
  whyItMatters: string;
};

/** Final executive approval page — same wording across Proposal / Presentation / Approval. */
export type ExecutiveDecisionSummary = {
  decisionRequested: string;
  whyApprovalRecommended: string;
  businessImpact: string;
  commercialImpact: string;
  openDecisions: string;
  immediateNextSteps: string[];
};

export type BriefCompletenessItem = {
  key: string;
  label: string;
  present: boolean;
  detail: string;
};

export type BriefCompleteness = {
  scorePercent: number;
  items: BriefCompletenessItem[];
  missingLabels: string[];
  summary: string;
};

export type StrategyPillar = {
  key: string;
  label: string;
  body: string;
};

/**
 * Single Planning Narrative — SSOT for all executive outputs.
 */
export type EnterprisePlanningNarrative = {
  /** Continuous story in spine order */
  spine: Array<{ key: PlanningNarrativeSpineKey; label: string; body: string }>;
  planningRequest: string;
  businessChallenge: string;
  strategicInsight: string;
  recommendedBusinessDecision: string;
  campaignStrategy: string;
  creatorStrategy: string;
  commercialStrategy: string;
  executionStrategy: string;
  expectedBusinessOutcome: string;
  assumptions: PlanningAssumption[];
  openDecisions: OpenDecision[];
  executiveRecommendation: string;
  /** Compact brief for executives (same wording as spine) */
  executiveBrief: {
    objective: string;
    strategy: string;
    creatorRecommendation: string;
    commercialOutlook: string;
    risks: string;
    expectedResults: string;
    planningConfidence: StrategyConfidence;
  };
  /** Fixed consulting strategy pillars for Executive Strategy surface */
  strategyPillars: StrategyPillar[];
  briefCompleteness: BriefCompleteness;
  budgetNarrative: {
    allocationLogic: string;
    commercialImpact: string;
    tradeOffs: string;
  };
  timelineNarrative: {
    phasesStory: string;
    whyTimingSupportsStrategy: string;
  };
  creatorPackageThesis: string;
  approvalJourney: {
    headline: string;
    steps: string[];
    freezeStatement: string;
    handoffStatement: string;
  };
  /** Presentation / Proposal opening recommendation (one paragraph) */
  packageOpening: string;
  /** Flagship slide beats */
  presentationBeats: Array<{ label: string; body: string }>;
  /** Concerns executives may raise — observations, not blockers */
  executiveObjections: ExecutiveObjection[];
  /** What must happen for this strategy to succeed */
  criticalSuccessFactors: CriticalSuccessFactor[];
  /** Final executive approval page */
  executiveDecisionSummary: ExecutiveDecisionSummary;
  /** Legacy summary shape for gradual consumers */
  legacySummary: StudioExecutivePlanningSummary;
};

function textOrInsufficient(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return INSUFFICIENT_EVIDENCE;
  return trimmed;
}

function fieldByLabel(
  fields: Array<{ label: string; value: string }>,
  ...labels: string[]
): string | undefined {
  for (const label of labels) {
    const hit = fields.find((f) => f.label.toLowerCase() === label.toLowerCase());
    if (hit?.value?.trim()) return hit.value.trim();
  }
  return undefined;
}

function buildBriefCompleteness(campaignObject: CampaignObject): BriefCompleteness {
  const facts = getCampaignFacts(campaignObject);
  const summary = resolveCampaignSummary(campaignObject);
  const briefText =
    facts?.rawBriefExcerpt?.trim() ||
    (typeof campaignObject.sections.summary?.content === "string"
      ? campaignObject.sections.summary.content.trim()
      : "");

  const items: BriefCompletenessItem[] = [
    {
      key: "briefText",
      label: "Planning request / brief text",
      present: Boolean(briefText && briefText.length >= 40),
      detail: briefText
        ? "Strategic intake text is available."
        : "Add a marketing brief or planning request (≥40 characters).",
    },
    {
      key: "objective",
      label: "Campaign objective",
      present: Boolean(facts?.objective?.trim() || summary?.objective?.trim()),
      detail: "Required to ground the recommended business decision.",
    },
    {
      key: "audience",
      label: "Audience",
      present: Boolean(facts?.audience?.trim() || summary?.targetAudience?.trim()),
      detail: "Required for audience and creator strategy.",
    },
    {
      key: "market",
      label: "Market / geography",
      present: Boolean(
        (summary?.market?.trim() &&
          !/\bplease\s+(search|find|build)\b/i.test(summary.market) &&
          summary.market.trim().length <= 60) ||
          (facts?.geography && facts.geography.length > 0)
      ),
      detail: "Required for market assumptions and media strategy.",
    },
    {
      key: "budget",
      label: "Budget",
      present: Boolean(facts?.budget?.amount || resolveBudgetData(campaignObject)?.total),
      detail: "Required for commercial strategy and trade-offs.",
    },
    {
      key: "platforms",
      label: "Platforms",
      present: Boolean(
        (facts?.platforms && facts.platforms.length > 0) || summary?.platforms?.trim()
      ),
      detail: "Required for media and execution strategy.",
    },
    {
      key: "kpis",
      label: "Success measurement / KPIs",
      present: Boolean(facts?.kpis && facts.kpis.length > 0),
      detail: "Required to define expected business outcome.",
    },
    {
      key: "brand",
      label: "Brand / client",
      present: Boolean(summary?.brand?.trim() || summary?.client?.trim() || facts),
      detail: "Required for client-facing package identity.",
    },
  ];

  const presentCount = items.filter((i) => i.present).length;
  const scorePercent = Math.round((presentCount / items.length) * 100);
  const missingLabels = items.filter((i) => !i.present).map((i) => i.label);
  const summaryText =
    missingLabels.length === 0
      ? "Brief is complete enough to support a boardroom Planning Package."
      : `Missing planning information: ${missingLabels.join(", ")}. Complete these before executive delivery.`;

  return { scorePercent, items, missingLabels, summary: summaryText };
}

function buildAssumptions(
  campaignObject: CampaignObject,
  signals?: StudioEciPlanningSignal[]
): PlanningAssumption[] {
  const facts = getCampaignFacts(campaignObject);
  const budget = resolveBudgetData(campaignObject);
  const list: PlanningAssumption[] = [];

  if (facts?.budget?.amount || budget?.total) {
    list.push({
      category: "Budget",
      statement:
        "Budget remains available as planned through activation; material cuts would require re-planning the slate and media mix.",
    });
  } else {
    list.push({
      category: "Budget",
      statement: "Budget is not yet confirmed — commercial recommendations are directional.",
    });
  }

  list.push({
    category: "Audience",
    statement: facts?.audience?.trim()
      ? `Audience targeting assumes ${facts.audience.trim()} remains the primary addressable group.`
      : "Audience definition is incomplete — creator fit assumes category-typical targeting until confirmed.",
  });

  list.push({
    category: "Market",
    statement:
      facts?.geography?.length
        ? `Market assumptions are grounded in ${facts.geography.join(", ")}.`
        : "Market / geography is not fully specified — reach and cultural fit remain assumptions.",
  });

  list.push({
    category: "Platform",
    statement:
      facts?.platforms?.length
        ? `Platform mix assumes ${facts.platforms.join(", ")} remain primary channels.`
        : "Platform allocation is not confirmed — media strategy remains provisional.",
  });

  const avgCoverage =
    signals && signals.length > 0
      ? Math.round(
          signals.reduce((s, x) => s + (x.evidenceCoveragePercent ?? 0), 0) / signals.length
        )
      : 0;
  list.push({
    category: "Historical evidence",
    statement:
      avgCoverage >= 50
        ? `Creator recommendations assume Enterprise Creator Intelligence evidence coverage (~${avgCoverage}%) remains representative.`
        : "Historical evidence coverage is limited for parts of the slate — treat creator confidence as directional until evidence improves.",
  });

  list.push({
    category: "Commercial",
    statement:
      "Creator fees and delivery economics assume current rate-card / commercial signals; negotiation outcomes may change efficiency.",
  });

  return list;
}

function buildExecutiveObjections(
  campaignObject: CampaignObject,
  completeness: BriefCompleteness,
  signals: StudioEciPlanningSignal[] | undefined,
  risks: string,
  commercialImpact: string
): ExecutiveObjection[] {
  const facts = getCampaignFacts(campaignObject);
  const creators = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const slateCount = creators.recommendations?.creatorIds?.length ?? 0;
  const avgCoverage =
    signals && signals.length > 0
      ? Math.round(
          signals.reduce((s, x) => s + (x.evidenceCoveragePercent ?? 0), 0) / signals.length
        )
      : 0;
  const objections: ExecutiveObjection[] = [];

  objections.push({
    concern: "Budget pressure",
    observation: facts?.budget?.amount
      ? "Executives may ask whether the planned budget remains protected through activation. This package assumes budget stays available; material cuts would require a controlled re-plan, not silent under-delivery."
      : "Budget is not yet confirmed. Treat commercial recommendations as directional until budget approval lands.",
  });

  objections.push({
    concern: "Audience overlap",
    observation: facts?.audience?.trim()
      ? `Audience concentration on ${facts.audience.trim()} may raise overlap questions across creators. Monitor reach duplication in Campaign Workspace rather than expanding the slate prematurely.`
      : "Audience definition is incomplete — overlap risk cannot be fully quantified until targeting is confirmed.",
  });

  objections.push({
    concern: "Limited historical evidence",
    observation:
      avgCoverage >= 50
        ? `Evidence coverage across the slate is approximately ${avgCoverage}%. Where coverage is thinner, recommendations remain directional and should be confirmed before production.`
        : "Historical evidence is limited for parts of the slate. Confidence is intentionally conservative; this is a planning observation, not a reason to stop.",
  });

  objections.push({
    concern: "Creative dependency",
    observation:
      "Outcomes depend on creative quality and brand-safe storytelling. Creative direction approval remains an open decision so quality stays intentional, not assumed.",
  });

  objections.push({
    concern: "Platform uncertainty",
    observation: facts?.platforms?.length
      ? `Platform mix assumes ${facts.platforms.join(", ")}. Algorithm or placement shifts are normal — keep amplification flexible inside the approved commercial envelope.`
      : "Platform allocation is not confirmed. Media strategy remains provisional until channels are locked.",
  });

  objections.push({
    concern: "Operational dependency",
    observation:
      slateCount > 0
        ? "Delivery depends on creator availability, contracting, and Campaign Workspace execution discipline after freeze."
        : "Creator slate is not yet confirmed — operational readiness depends on completing slate selection first.",
  });

  objections.push({
    concern: "Competitive activity",
    observation:
      "Competitive noise in-category may dilute share of voice. Phased timing and distinctive creator strategy are designed to protect attention without overstating certainty.",
  });

  objections.push({
    concern: "Approval timing",
    observation:
      "Delayed approval compresses production and proof windows. Approving now preserves the planned execution narrative; deferral is a timing trade-off, not a strategy failure.",
  });

  objections.push({
    concern: "Legal dependency",
    observation:
      "Exclusivity, disclosure, and compliance confirmations may still be required. These are standard planning observations and should be cleared in parallel with approval.",
  });

  objections.push({
    concern: "Execution dependency",
    observation:
      "Business results require disciplined handoff into Campaign Workspace after freeze. Planning quality alone does not deliver outcomes without execution follow-through.",
  });

  if (risks && risks !== INSUFFICIENT_EVIDENCE) {
    objections.push({
      concern: "Campaign-specific risk",
      observation: `${risks} — monitored as a planning observation with mitigations in the creator and commercial narratives.`,
    });
  }

  if (commercialImpact === INSUFFICIENT_EVIDENCE || completeness.missingLabels.includes("Budget")) {
    objections.push({
      concern: "Commercial confirmation",
      observation:
        "Commercial outlook remains assumption-led until fees and budget are confirmed. Do not treat provisional efficiency language as a guaranteed return.",
    });
  }

  return objections.slice(0, 10);
}

function buildCriticalSuccessFactors(
  campaignObject: CampaignObject,
  reasoningSuccess: string[] | undefined
): CriticalSuccessFactor[] {
  const facts = getCampaignFacts(campaignObject);
  const factors: CriticalSuccessFactor[] = [
    {
      factor: "Creative quality maintained",
      whyItMatters:
        "Creator content must stay on-brief and brand-safe; creative dilution is the fastest way to lose the strategic advantage of this slate.",
    },
    {
      factor: "Budget preserved",
      whyItMatters:
        "The commercial strategy assumes the planned investment envelope. Cuts without re-planning weaken both reach and proof.",
    },
    {
      factor: "Timeline maintained",
      whyItMatters:
        "Phased timing is part of the strategy. Compressing waves collapses seed → amplify → prove sequencing.",
    },
    {
      factor: "Creator availability confirmed",
      whyItMatters:
        "Recommended creators must remain available through contracting; late substitutions should reuse Decision Narrative standards, not ad-hoc swaps.",
    },
    {
      factor: "Audience assumptions remain valid",
      whyItMatters: facts?.audience?.trim()
        ? `Strategy assumes ${facts.audience.trim()} remains the primary audience. Material audience shifts require strategy review.`
        : "Audience assumptions must be confirmed; invalid targeting breaks creator and media logic.",
    },
  ];

  if (reasoningSuccess?.length) {
    for (const condition of reasoningSuccess.slice(0, 3)) {
      factors.push({
        factor: condition,
        whyItMatters: "Director success condition carried from strategy reasoning into package delivery.",
      });
    }
  }

  if (facts?.platforms?.length) {
    factors.push({
      factor: "Platform mix remains executable",
      whyItMatters: `Primary channels (${facts.platforms.join(", ")}) must stay available for the planned content formats.`,
    });
  }

  return factors.slice(0, 8);
}

function buildOpenDecisions(
  campaignObject: CampaignObject,
  completeness: BriefCompleteness,
  signals?: StudioEciPlanningSignal[]
): OpenDecision[] {
  const decisions: OpenDecision[] = [];
  const facts = getCampaignFacts(campaignObject);
  const creators = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const slateCount = creators.recommendations?.creatorIds?.length ?? 0;

  if (!facts?.budget?.amount && !resolveBudgetData(campaignObject)?.total) {
    decisions.push({
      decision: "Budget approval pending",
      ownerHint: "Client / Commercial",
    });
  }
  if (!facts?.platforms?.length) {
    decisions.push({
      decision: "Platform allocation confirmation",
      ownerHint: "Brand / Media",
    });
  }
  if (slateCount === 0) {
    decisions.push({
      decision: "Creator slate confirmation",
      ownerHint: "Planning / Brand",
    });
  } else {
    decisions.push({
      decision: "Creator exclusivity / conflict confirmation where required",
      ownerHint: "Legal / Brand",
    });
  }
  if (!facts?.kpis?.length) {
    decisions.push({
      decision: "Success measurement / KPI confirmation",
      ownerHint: "Brand / Analytics",
    });
  }
  if (completeness.missingLabels.includes("Audience")) {
    decisions.push({
      decision: "Audience definition confirmation",
      ownerHint: "Brand / Insights",
    });
  }
  decisions.push({
    decision: "Timeline confirmation for go-live window",
    ownerHint: "Brand / Operations",
  });
  decisions.push({
    decision: "Creative direction approval before production",
    ownerHint: "Brand / Creative",
  });

  const thinEvidence =
    signals?.some((s) => (s.evidenceCoveragePercent ?? 0) < 40) ?? false;
  if (thinEvidence) {
    decisions.push({
      decision: "Accept directional creator recommendations where evidence is thin",
      ownerHint: "Planning Director",
    });
  }

  return decisions;
}

/**
 * Derive the Enterprise Planning Package narrative from Campaign Object (+ optional ECI).
 */
export function deriveEnterprisePlanningNarrative(
  campaignObject: CampaignObject,
  signals?: StudioEciPlanningSignal[]
): EnterprisePlanningNarrative {
  const facts = getCampaignFacts(campaignObject);
  const summary = resolveCampaignSummary(campaignObject);
  const strategy = resolveExecutiveStrategy(campaignObject);
  const reasoning = resolveExecutiveStrategyReasoning(campaignObject);
  const grounded = resolveGroundedStrategyFields(campaignObject);
  const groundedPairs = grounded.map((f) => ({ label: f.label, value: f.value }));
  const budget = resolveBudgetData(campaignObject);
  const timeline = resolveTimelineData(campaignObject);
  const legacySummary = buildStudioExecutivePlanningSummary(campaignObject, signals);
  const briefCompleteness = buildBriefCompleteness(campaignObject);

  const recommended = (signals ?? []).filter(
    (s) => toCampaignDecisionLabel(s.recommendation) === "Recommended"
  );
  const primary = recommended[0] ?? signals?.[0];
  const primaryNarrative = primary ? buildRecommendationNarrative(primary) : null;
  const slateCount =
    recommended.length > 0
      ? recommended.length
      : ((campaignObject.sections.creators.data as CreatorsSectionData | undefined)?.recommendations
          ?.creatorIds?.length ?? 0);
  const strategyMixLine =
    resolveCreatorMix(campaignObject)
      .map((t) => {
        if (t.percent != null) return `${t.tier} ${t.percent}%`;
        if (t.count != null) return `${t.count} ${t.tier}`;
        return t.tier;
      })
      .join(" · ") || legacySummary.recommendedCreatorMix;

  const planningRequest = toBoardroomLanguage(
    textOrInsufficient(
      facts?.rawBriefExcerpt?.slice(0, 400) ||
        (typeof campaignObject.sections.summary.content === "string"
          ? campaignObject.sections.summary.content.slice(0, 400)
          : undefined) ||
        facts?.objective ||
        summary?.objective
    )
  );

  const businessChallenge = toBoardroomLanguage(
    textOrInsufficient(
      reasoning?.businessChallenge ||
        fieldByLabel(groundedPairs, "Business Challenge") ||
        (facts?.objective
          ? `Deliver measurable business results against: ${facts.objective}`
          : undefined)
    )
  );

  const strategicInsight = toBoardroomLanguage(
    textOrInsufficient(
      reasoning?.strategicInsight ||
        fieldByLabel(groundedPairs, "Strategic Insight") ||
        reasoning?.whyThisStrategyWins ||
        strategy?.keyMessage
    )
  );

  const campaignStrategy = toBoardroomLanguage(
    textOrInsufficient(
      reasoning?.chosenStrategy ||
        fieldByLabel(groundedPairs, "Chosen Strategy", "Campaign Strategy", "Strategy") ||
        strategy?.objective ||
        legacySummary.recommendedStrategy
    )
  );

  const creatorStrategy = toBoardroomLanguage(
    textOrInsufficient(
      fieldByLabel(groundedPairs, "Creator Strategy") ||
        strategy?.creatorStrategy ||
        (slateCount > 0
          ? `Advance ${slateCount} evidence-backed creator${slateCount === 1 ? "" : "s"} on the planning slate for this objective${
              strategyMixLine ? `, guided by the Director tier mix (${strategyMixLine})` : ""
            }.`
          : undefined)
    )
  );

  const contentStrategy = toBoardroomLanguage(
    textOrInsufficient(
      fieldByLabel(groundedPairs, "Content Strategy", "Message", "Key Message") ||
        strategy?.keyMessage ||
        (facts?.platforms?.length && facts?.objective
          ? `Produce creator-native content on ${facts.platforms.join(" and ")} that advances ${facts.objective} through authentic storytelling rather than brand-only messaging.`
          : undefined)
    )
  );

  const mediaStrategy = toBoardroomLanguage(
    textOrInsufficient(
      fieldByLabel(groundedPairs, "Platform Strategy", "Media Strategy") ||
        (facts?.platforms?.length
          ? `Prioritize ${facts.platforms.join(", ")} to concentrate reach where the audience is most addressable.`
          : undefined)
    )
  );

  const commercialStrategy = toBoardroomLanguage(
    textOrInsufficient(
      budget?.budgetPlannerReasoning ||
        primaryNarrative?.commercialValue ||
        (legacySummary.commercialOutlook !== INSUFFICIENT_EVIDENCE
          ? legacySummary.commercialOutlook
          : undefined) ||
        (budget?.total
          ? `Allocate the ${budget.currency ?? ""} ${budget.total.toLocaleString()} budget to maximize creator-driven business outcomes with clear fee vs amplification trade-offs.`
          : facts?.budget?.amount
            ? `Allocate ${facts.budget.currency} ${facts.budget.amount.toLocaleString()} across creator tiers to maximize delivery against the campaign objective.`
            : undefined)
    )
  );

  const executionStrategy = (() => {
    if (!timeline?.weeks?.length) {
      return textOrInsufficient(
        "Execution timing will be confirmed once the activation window is finalized."
      );
    }
    const phases = timeline.weeks
      .slice(0, 5)
      .map((w) => `Week ${w.week}: ${w.phase}`)
      .join(" → ");
    return `Execute in phased waves — ${phases}. Timing concentrates creator momentum to support the campaign objective rather than a one-day spike.`;
  })();

  const expectedBusinessOutcome = toBoardroomLanguage(
    textOrInsufficient(
      (legacySummary.expectedBusinessResults !== INSUFFICIENT_EVIDENCE
        ? legacySummary.expectedBusinessResults
        : undefined) ||
        facts?.kpis?.slice(0, 3).join(", ") ||
        reasoning?.successConditions?.join("; ") ||
        (facts?.objective
          ? `Progress against ${facts.objective} within the planned activation window on ${(facts.platforms ?? []).join(" + ") || "priority platforms"}.`
          : undefined)
    )
  );

  const risks = toBoardroomLanguage(
    textOrInsufficient(
      (legacySummary.businessRisks !== INSUFFICIENT_EVIDENCE
        ? legacySummary.businessRisks
        : undefined) ||
        reasoning?.risks?.join("; ") ||
        primaryNarrative?.risks ||
        "Creator availability, creative quality, and budget protection remain the primary planning risks to monitor through approval."
    )
  );

  const recommendedBusinessDecision = toBoardroomLanguage(
    textOrInsufficient(
      reasoning?.directorConclusion ||
        reasoning?.whyThisStrategyWins ||
        `Recommend proceeding with the proposed creator-led campaign strategy to deliver: ${legacySummary.campaignObjective}`
    )
  );

  const executiveRecommendation = toBoardroomLanguage(
    [
      `What we should do: ${recommendedBusinessDecision}`,
      `Why: ${strategicInsight}`,
      `Business value: ${expectedBusinessOutcome}`,
      `Why this is strongest: ${campaignStrategy}`,
    ].join(" ")
  );

  const assumptions = buildAssumptions(campaignObject, signals);
  const openDecisions = buildOpenDecisions(campaignObject, briefCompleteness, signals);

  const audienceStrategy = toBoardroomLanguage(
    textOrInsufficient(
      fieldByLabel(groundedPairs, "Target Audience", "Audience Strategy", "Audience Challenge") ||
        reasoning?.audienceChallenge ||
        summary?.targetAudience ||
        facts?.audience
    )
  );

  const successMeasurement = textOrInsufficient(
    reasoning?.successConditions?.join("; ") ||
      facts?.kpis?.slice(0, 4).join(", ") ||
      expectedBusinessOutcome
  );

  const strategyPillars: StrategyPillar[] = [
    { key: "businessChallenge", label: "Business Challenge", body: businessChallenge },
    { key: "strategicInsight", label: "Strategic Insight", body: strategicInsight },
    {
      key: "campaignObjective",
      label: "Campaign Objective",
      body: textOrInsufficient(legacySummary.campaignObjective || facts?.objective),
    },
    { key: "audienceStrategy", label: "Audience Strategy", body: audienceStrategy },
    { key: "creatorStrategy", label: "Creator Strategy", body: creatorStrategy },
    { key: "contentStrategy", label: "Content Strategy", body: contentStrategy },
    { key: "mediaStrategy", label: "Media Strategy", body: mediaStrategy },
    { key: "commercialStrategy", label: "Commercial Strategy", body: commercialStrategy },
    { key: "successMeasurement", label: "Success Measurement", body: successMeasurement },
    { key: "businessRisks", label: "Business Risks", body: risks },
    {
      key: "expectedBusinessOutcome",
      label: "Expected Business Outcome",
      body: expectedBusinessOutcome,
    },
  ];

  const allocationLogic =
    budget?.budgetPlannerReasoning?.trim() ||
    (budget?.allocations?.length
      ? `Budget is concentrated where creator delivery most directly supports the objective: ${budget.allocations
          .slice(0, 4)
          .map((a) => `${a.category}${a.percent != null ? ` (${a.percent}%)` : ""}`)
          .join(", ")}.`
      : INSUFFICIENT_EVIDENCE);

  const commercialImpact = textOrInsufficient(
    primaryNarrative?.commercialValue ||
      legacySummary.commercialOutlook ||
      "Commercial impact depends on confirmed fees and delivery against the planned budget."
  );

  const budgetTradeOffs = textOrInsufficient(
    legacySummary.tradeOffs ||
      reasoning?.expectedTradeoffs?.join("; ") ||
      "Trade-off: concentrating budget on fewer high-fit creators versus spreading spend for broader coverage."
  );

  const phasesStory = executionStrategy;
  const whyTimingSupportsStrategy = timeline?.weeks?.length
    ? `Phased timing supports the strategy by building awareness before proof moments, then concentrating creator output when the audience is most receptive — aligned to a ${timeline.weeks.length}-week planning window.`
    : INSUFFICIENT_EVIDENCE;

  const creatorPackageThesis =
    recommended.length > 0
      ? `Creator strategy thesis: ${creatorStrategy} This slate is the strongest recommendation because it best supports the campaign objective with available evidence, commercial outlook, and manageable risk (${legacySummary.planningConfidence.level} planning confidence).`
      : `Creator strategy thesis: ${creatorStrategy}`;

  // Identical to executiveRecommendation — no parallel package-level summary wording.
  const packageOpening = executiveRecommendation;

  const executiveObjections = buildExecutiveObjections(
    campaignObject,
    briefCompleteness,
    signals,
    risks,
    commercialImpact
  );
  const criticalSuccessFactors = buildCriticalSuccessFactors(
    campaignObject,
    reasoning?.successConditions
  );

  const immediateNextSteps = [
    "Approve the Enterprise Planning Package to freeze the planning baseline.",
    "Clear remaining open decisions in parallel (budget, exclusivity, creative direction, timeline).",
    "Generate the campaign in Campaign Workspace and begin execution without rebuilding this package.",
  ];

  const executiveDecisionSummary: ExecutiveDecisionSummary = {
    decisionRequested:
      "Approve this Enterprise Planning Package as the planning baseline and authorize handoff into Campaign Workspace.",
    whyApprovalRecommended: [
      recommendedBusinessDecision,
      `Planning confidence: ${legacySummary.planningConfidence.level}.`,
      strategicInsight !== INSUFFICIENT_EVIDENCE ? strategicInsight : "",
    ]
      .filter(Boolean)
      .join(" "),
    businessImpact: expectedBusinessOutcome,
    commercialImpact,
    openDecisions: openDecisions.map((d) => `${d.decision} (${d.ownerHint})`).join(" · "),
    immediateNextSteps,
  };

  const spine: EnterprisePlanningNarrative["spine"] = [
    { key: "planningRequest", label: "Planning Request", body: planningRequest },
    { key: "businessChallenge", label: "Business Challenge", body: businessChallenge },
    { key: "strategicInsight", label: "Strategic Insight", body: strategicInsight },
    {
      key: "recommendedBusinessDecision",
      label: "Recommended Business Decision",
      body: recommendedBusinessDecision,
    },
    { key: "campaignStrategy", label: "Campaign Strategy", body: campaignStrategy },
    { key: "creatorStrategy", label: "Creator Strategy", body: creatorStrategy },
    { key: "commercialStrategy", label: "Commercial Strategy", body: commercialStrategy },
    { key: "executionStrategy", label: "Execution Strategy", body: executionStrategy },
    {
      key: "expectedBusinessOutcome",
      label: "Expected Business Outcome",
      body: expectedBusinessOutcome,
    },
    {
      key: "assumptions",
      label: "Assumptions",
      body: assumptions.map((a) => `${a.category}: ${a.statement}`).join(" · "),
    },
    {
      key: "openDecisions",
      label: "Open Decisions",
      body: openDecisions.map((d) => `${d.decision} (${d.ownerHint})`).join(" · "),
    },
    {
      key: "executiveRecommendation",
      label: "Executive Recommendation",
      body: executiveRecommendation,
    },
  ];

  const presentationBeats = [
    { label: "Challenge", body: businessChallenge },
    { label: "Recommendation", body: recommendedBusinessDecision },
    {
      label: "Evidence",
      body: textOrInsufficient(
        primaryNarrative?.evidence ||
          reasoning?.evidence?.slice(0, 3).join("; ") ||
          legacySummary.planningConfidence.evidenceSupports
      ),
    },
    { label: "Business Value", body: expectedBusinessOutcome },
    { label: "Commercial Value", body: commercialImpact },
    { label: "Expected Outcome", body: expectedBusinessOutcome },
    { label: "Risks", body: risks },
    {
      label: "Confidence",
      body: `${legacySummary.planningConfidence.level} — ${legacySummary.planningConfidence.why}`,
    },
    {
      label: "Approval Request",
      body: executiveDecisionSummary.decisionRequested,
    },
  ];

  return {
    spine,
    planningRequest,
    businessChallenge,
    strategicInsight,
    recommendedBusinessDecision,
    campaignStrategy,
    creatorStrategy,
    commercialStrategy,
    executionStrategy,
    expectedBusinessOutcome,
    assumptions,
    openDecisions,
    executiveRecommendation,
    executiveBrief: {
      objective: legacySummary.campaignObjective,
      strategy: campaignStrategy,
      creatorRecommendation: creatorStrategy,
      commercialOutlook: commercialImpact,
      risks,
      expectedResults: expectedBusinessOutcome,
      planningConfidence: legacySummary.planningConfidence,
    },
    strategyPillars,
    briefCompleteness,
    budgetNarrative: {
      allocationLogic,
      commercialImpact,
      tradeOffs: budgetTradeOffs,
    },
    timelineNarrative: {
      phasesStory,
      whyTimingSupportsStrategy,
    },
    creatorPackageThesis,
    approvalJourney: {
      headline: "Enterprise Planning Package → Approval → Freeze → Campaign Workspace",
      steps: [
        "Complete the Enterprise Planning Package",
        "Submit for review / Approve",
        "Freeze the approved Planning Package",
        "Generate campaign in Campaign Workspace for execution",
      ],
      freezeStatement:
        "On approval, the Planning Package is frozen as the planning baseline. Execution ownership moves to Campaign Workspace — do not re-plan in Studio unless stakeholders reopen decisions.",
      handoffStatement:
        "After freeze, move immediately into Campaign Workspace. Quotation, assignments, and delivery run there without rebuilding this package.",
    },
    packageOpening,
    presentationBeats,
    executiveObjections,
    criticalSuccessFactors,
    executiveDecisionSummary,
    legacySummary,
  };
}

/** Final executive decision page lines — Proposal / Presentation / Approval. */
export function formatExecutiveDecisionSummaryLines(
  narrative: EnterprisePlanningNarrative
): Array<{ label: string; body: string }> {
  const d = narrative.executiveDecisionSummary;
  return [
    { label: "Decision Requested", body: d.decisionRequested },
    { label: "Why approval is recommended", body: d.whyApprovalRecommended },
    { label: "Business impact", body: d.businessImpact },
    { label: "Commercial impact", body: d.commercialImpact },
    { label: "Open decisions", body: d.openDecisions },
    {
      label: "Immediate next steps",
      body: d.immediateNextSteps.join(" → "),
    },
  ];
}

/** Compact executive brief lines — same wording as the narrative. */
export function formatExecutiveBriefLines(
  narrative: EnterprisePlanningNarrative
): Array<{ label: string; body: string }> {
  const b = narrative.executiveBrief;
  return [
    { label: "Objective", body: b.objective },
    { label: "Strategy", body: b.strategy },
    { label: "Creator Recommendation", body: b.creatorRecommendation },
    { label: "Commercial Outlook", body: b.commercialOutlook },
    { label: "Risks", body: b.risks },
    { label: "Expected Results", body: b.expectedResults },
    {
      label: "Planning Confidence",
      body: `${b.planningConfidence.level} — ${b.planningConfidence.why}`,
    },
  ];
}

/**
 * Canonical package fields that must be identical across every consumer.
 * Consumers must copy these strings — never rewrite.
 */
export function getCanonicalPlanningPackageFields(
  narrative: EnterprisePlanningNarrative
): Record<string, string> {
  return {
    businessChallenge: narrative.businessChallenge,
    strategicInsight: narrative.strategicInsight,
    recommendedBusinessDecision: narrative.recommendedBusinessDecision,
    campaignStrategy: narrative.campaignStrategy,
    creatorStrategy: narrative.creatorStrategy,
    commercialStrategy: narrative.commercialStrategy,
    executionStrategy: narrative.executionStrategy,
    expectedBusinessOutcome: narrative.expectedBusinessOutcome,
    assumptions: narrative.assumptions
      .map((a) => `${a.category}: ${a.statement}`)
      .join(" · "),
    executiveObjections: narrative.executiveObjections
      .map((o) => `${o.concern}: ${o.observation}`)
      .join(" · "),
    criticalSuccessFactors: narrative.criticalSuccessFactors
      .map((f) => `${f.factor}: ${f.whyItMatters}`)
      .join(" · "),
    openDecisions: narrative.openDecisions
      .map((d) => `${d.decision} (${d.ownerHint})`)
      .join(" · "),
    executiveRecommendation: narrative.executiveRecommendation,
    decisionRequested: narrative.executiveDecisionSummary.decisionRequested,
  };
}
