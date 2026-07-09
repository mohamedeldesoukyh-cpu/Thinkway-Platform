import type { WorkflowTaskResult } from "@/features/ai-workflows/types";

import { buildIs1ReasoningBundle } from "@/features/campaign-intelligence/services/reasoning";
import {
  applyWinnerOptionToStrategy,
  runDirectorDebateEngine,
} from "../debate";
import type { CampaignFacts } from "../facts/campaign-facts-types";
import { extractCampaignFacts } from "../facts/extract-campaign-facts";
import { formatCampaignFactsForSpecialist } from "../facts/facts-to-context";
import { validateCampaignFacts } from "../facts/validate-campaign-facts";
import type {
  CampaignBriefInput,
  CampaignStrategyDocument,
  DirectorApprovedSection,
  DirectorPipelineResult,
  DirectorPipelineState,
} from "../types";
import { evaluateApprovalGate } from "./approval-gate";
import { evaluateDecisionIntelligenceGate } from "./decision-intelligence-gate";
import { runGovernancePipeline } from "@/features/campaign-governance/governance-pipeline";
import { validateBudgetTotals100, buildDirectorBudgetFromStrategy } from "./budget-rules";
import { runCrossReview } from "./cross-review-engine";
import {
  markSpecialistsApproved,
  runDirectorChallengeLoop,
} from "./director-challenge-loop";
import {
  dispatchSpecialists,
  mergeTaskOutputsIntoSpecialists,
} from "./specialist-dispatch";
import {
  formatStrategyForSpecialist,
  writeStrategyDocumentFromBrief,
} from "./strategy-document";
import { buildClientTimelineFromStrategy, isInternalTimelinePhase } from "./timeline-rules";
import { getSpecialistDomain } from "./specialist-dispatch";

export type RunDirectorPipelineInput = {
  brief: CampaignBriefInput;
  taskResults?: Record<string, WorkflowTaskResult>;
  campaignFacts?: CampaignFacts;
};

/**
 * Campaign Director orchestrates the full intelligence pipeline:
 * Brief → Facts SSOT → Strategy → Specialists → Cross Review → Challenge → Approval → Sections
 */
export function runCampaignDirectorPipeline(
  input: RunDirectorPipelineInput
): DirectorPipelineResult {
  const briefText = input.brief.rawMessage;
  const campaignFacts =
    input.campaignFacts ??
    input.brief.campaignFacts ??
    validateCampaignFacts(
      extractCampaignFacts({
        rawMessage: input.brief.rawMessage,
        brandName: input.brief.brandName,
        clientName: input.brief.clientName,
      })
    );

  const baseStrategyDocument = writeStrategyDocumentFromBrief(
    { ...input.brief, campaignFacts },
    campaignFacts
  );

  const debateResult = runDirectorDebateEngine(campaignFacts, baseStrategyDocument);
  const strategyDocument = applyWinnerOptionToStrategy(baseStrategyDocument, debateResult);

  const specialistOutputs = input.taskResults
    ? mergeTaskOutputsIntoSpecialists(strategyDocument, briefText, input.taskResults, campaignFacts)
    : dispatchSpecialists(strategyDocument, briefText, undefined, campaignFacts);

  const timelineContent = input.taskResults?.["generate-timeline"]?.content;

  const crossReviewFindings = runCrossReview(
    strategyDocument,
    specialistOutputs,
    briefText,
    timelineContent
  );

  const challengeResult = runDirectorChallengeLoop({
    strategy: strategyDocument,
    briefText,
    outputs: specialistOutputs,
    crossReviewFindings,
    timelineContent,
  });

  const approvedOutputs = markSpecialistsApproved(challengeResult.outputs);
  const budget = buildDirectorBudgetFromStrategy(challengeResult.strategy, briefText, campaignFacts);
  const clientTimeline = buildClientTimelineFromStrategy(challengeResult.strategy);
  const timelineClientFacing = !clientTimeline.some((w) => isInternalTimelinePhase(w.phase));

  const reasoningBundle = buildIs1ReasoningBundle(campaignFacts, challengeResult.strategy, {
    briefText,
    specialistOutputs: approvedOutputs,
    debateResult,
  });

  const decisionIntelligenceGate = evaluateDecisionIntelligenceGate({
    facts: campaignFacts,
    strategy: challengeResult.strategy,
    reasoning: reasoningBundle,
    budget,
    briefText,
  });

  let approvalGate = evaluateApprovalGate({
    challenges: challengeResult.challenges,
    crossReviewFindings: challengeResult.crossReviewFindings,
    revisionRounds: challengeResult.revisionRounds,
    budgetValid: validateBudgetTotals100(budget.allocations),
    timelineClientFacing,
  });

  if (!decisionIntelligenceGate.passed) {
    approvalGate = {
      ...approvalGate,
      approved: false,
      blockers: [...approvalGate.blockers, ...decisionIntelligenceGate.blockers],
    };
  }

  const governanceResult = runGovernancePipeline({
    briefText,
    facts: campaignFacts,
    strategy: challengeResult.strategy,
    specialistOutputs: approvedOutputs,
    budget,
    timelineWeeks:
      clientTimeline.length || challengeResult.strategy.understanding.timeline?.durationWeeks || 6,
  });

  if (!governanceResult.releaseApproved) {
    approvalGate = {
      ...approvalGate,
      approved: false,
      blockers: [
        ...approvalGate.blockers,
        ...governanceResult.directorApproval.decision.blockers,
      ],
    };
  }

  const approvedSections = buildApprovedSections(
    challengeResult.strategy,
    approvedOutputs,
    budget,
    clientTimeline,
    approvalGate.approved,
    campaignFacts,
    briefText,
    reasoningBundle
  );

  return {
    strategyDocument: challengeResult.strategy,
    specialistOutputs: approvedOutputs,
    crossReviewFindings: challengeResult.crossReviewFindings,
    challenges: challengeResult.challenges,
    approvalGate,
    decisionIntelligenceGate,
    governance: governanceResult,
    approvedSections,
    reviewReport: challengeResult.reviewReport,
    debateResult,
  };
}

function buildApprovedSections(
  strategy: CampaignStrategyDocument,
  outputs: ReturnType<typeof markSpecialistsApproved>,
  budget: ReturnType<typeof buildDirectorBudgetFromStrategy>,
  timeline: ReturnType<typeof buildClientTimelineFromStrategy>,
  approved: boolean,
  campaignFacts?: CampaignFacts,
  briefText?: string,
  reasoningBundle?: ReturnType<typeof buildIs1ReasoningBundle>
): DirectorApprovedSection[] {
  if (!approved) return [];

  const strategyOutput = outputs.find((o) => o.specialistId === "strategy");
  const financeOutput = outputs.find((o) => o.specialistId === "finance");
  const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
  const mediaOutput = outputs.find((o) => o.specialistId === "media_planner");
  const performanceOutput = outputs.find((o) => o.specialistId === "performance");
  const riskOutput = outputs.find((o) => o.specialistId === "risk");
  const presentationOutput = outputs.find((o) => o.specialistId === "presentation");

  const is1 = reasoningBundle ?? null;

  const sections: DirectorApprovedSection[] = [
    {
      sectionKey: "strategy",
      content: strategy.narrative,
      data: is1
        ? {
            executiveStrategyReasoning: is1.executiveStrategy,
            directorDecisionMinutes: is1.directorDecisionMinutes,
            creatorMixReasoning: is1.creatorMix.tiers,
            creatorMixSummary: { whyMix: is1.creatorMix.whyMix },
          }
        : undefined,
      rationale: strategyOutput?.why ?? "Director SSOT strategy document",
      approvedBy: "strategy",
    },
    {
      sectionKey: "summary",
      content: [
        `Brand: ${strategy.understanding.brand}`,
        `Objective: ${strategy.understanding.objective}`,
        `Audience: ${strategy.understanding.audience}`,
        strategy.understanding.budget?.amount
          ? `Budget: ${strategy.understanding.budget.currency} ${strategy.understanding.budget.amount.toLocaleString()}`
          : null,
        `Duration: ${strategy.understanding.timeline?.durationWeeks ?? 6} weeks`,
      ]
        .filter(Boolean)
        .join("\n"),
      rationale: strategyOutput?.why ?? "Executive summary from Director strategy",
      approvedBy: "strategy",
    },
    {
      sectionKey: "audience",
      content: strategy.understanding.audience,
      rationale: "Audience defined in Director strategy — all specialists aligned",
      approvedBy: "strategy",
    },
    {
      sectionKey: "budget",
      content: budget,
      data: is1
        ? {
            allocationReasoning: is1.budgetPlanner.allocations,
            budgetPlannerReasoning: is1.budgetPlanner.directorRationale,
          }
        : undefined,
      rationale: financeOutput?.why ?? "Influencer marketing budget with 100% allocation",
      approvedBy: "finance",
    },
    {
      sectionKey: "timeline",
      content: {
        durationWeeks: strategy.understanding.timeline?.durationWeeks,
        milestones: timeline.map((w) => ({
          week: w.week,
          phase: w.phase,
          activities: w.activities,
          status: "pending" as const,
        })),
      },
      data: is1 ? { creatorActivationTimeline: is1.creatorActivationTimeline } : undefined,
      rationale: mediaOutput?.why ?? "Creator activation timeline — reporting after duration",
      approvedBy: "media_planner",
    },
    {
      sectionKey: "performance",
      content: {
        kpis: strategy.understanding.kpis.map((k) => ({
          metric: k.metric,
          target: k.target,
        })),
        forecastNotes: performanceOutput?.why,
      },
      data: is1 ? { kpiReasoning: is1.kpiForecast.kpis } : undefined,
      rationale: performanceOutput?.why ?? "KPIs anchored to strategy objectives",
      approvedBy: "performance",
    },
    {
      sectionKey: "creators",
      content: creatorOutput?.what ?? "",
      data: is1
        ? {
            vendorDiscoveryFunnel: is1.vendorDiscoveryFunnel,
            discoveryPipeline: is1.vendorDiscoveryFunnel,
            recommendations: {
              creatorIds: [],
              selectedReasoning: is1.vendorRecommendations.selected,
              rejectedReasoning: is1.vendorRecommendations.rejected,
            },
            creatorMixReasoning: is1.creatorMix.tiers,
            creatorMixSummary: { whyMix: is1.creatorMix.whyMix },
          }
        : undefined,
      rationale: creatorOutput?.why ?? "Creator tier mix per Director strategy",
      approvedBy: "creator_intelligence",
    },
    {
      sectionKey: "operations",
      content: {
        risks: (strategy.understanding.risks.length > 0
          ? strategy.understanding.risks
          : ["Vendor availability variance"]
        ).map((risk) => ({
          risk,
          severity: "medium" as const,
          category: "strategy",
        })),
        overallRiskLevel: "medium" as const,
      },
      rationale: riskOutput?.why ?? "Risk assessment from strategy constraints",
      approvedBy: "risk",
    },
    {
      sectionKey: "presentation",
      content:
        presentationOutput?.what ??
        `Campaign ready for approval — ${strategy.understanding.brand}`,
      rationale: presentationOutput?.why ?? "All sections validated — zero unresolved conflicts",
      approvedBy: "presentation",
    },
  ];

  return sections;
}

/** Initialize director pipeline at workflow start — extracts facts then writes SSOT strategy. */
export function initializeDirectorPipelineState(
  userMessage: string,
  brandName?: string
): {
  strategyDocument: CampaignStrategyDocument;
  campaignFacts: CampaignFacts;
  pipelineState: DirectorPipelineState;
} {
  const campaignFacts = validateCampaignFacts(
    extractCampaignFacts({ rawMessage: userMessage, brandName })
  );
  const strategyDocument = writeStrategyDocumentFromBrief(
    { rawMessage: userMessage, brandName, campaignFacts },
    campaignFacts
  );

  return {
    strategyDocument,
    campaignFacts,
    pipelineState: { phase: "strategy" },
  };
}

/** Build specialist prompt prefix from strategy document and campaign facts SSOT. */
export function buildDirectorTaskPrompt(
  strategy: CampaignStrategyDocument,
  specialistDomain: string,
  taskInstruction: string,
  campaignFacts?: CampaignFacts
): string {
  const factsBlock = campaignFacts ? formatCampaignFactsForSpecialist(campaignFacts) : undefined;
  return [
    formatStrategyForSpecialist(strategy, specialistDomain, factsBlock),
    "",
    "=== TASK ===",
    taskInstruction,
    "",
    "Respond with WHAT (recommendation) and WHY (rationale tied to strategy).",
  ].join("\n");
}

export function getStrategyFromWorkflowData(
  data: Record<string, unknown>
): CampaignStrategyDocument | undefined {
  return data.campaignStrategyDocument as CampaignStrategyDocument | undefined;
}

export function getCampaignFactsFromWorkflowData(
  data: Record<string, unknown>
): CampaignFacts | undefined {
  return data.campaignFacts as CampaignFacts | undefined;
}

export const DIRECTOR_PIPELINE_STATE_KEY = "directorPipeline";

export function finalizeDirectorPipelineFromWorkflow(input: {
  userMessage: string;
  brandName?: string;
  taskResults: Record<string, WorkflowTaskResult>;
  campaignFacts?: CampaignFacts;
}): DirectorPipelineResult {
  return runCampaignDirectorPipeline({
    brief: {
      rawMessage: input.userMessage,
      brandName: input.brandName,
      campaignFacts: input.campaignFacts,
    },
    taskResults: input.taskResults,
    campaignFacts: input.campaignFacts,
  });
}

export { formatStrategyForSpecialist, writeStrategyDocumentFromBrief, getSpecialistDomain };
