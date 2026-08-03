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
import {
  buildGovernanceUserQuestions,
  classifyGovernanceCheck,
  collectFailingGovernanceChecks,
  governanceMaxRepairAttempts,
  repairGovernanceArtifacts,
  shouldAskUserForGovernanceCheck,
  type GovernanceRepairLogEntry,
  type GovernanceRepairSummary,
} from "@/features/campaign-governance/governance-repair";
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

  // Governance self-repair loop: evaluate the gates, classify every failing
  // check, deterministically repair only the affected artifacts, and
  // re-evaluate — until approved or the configurable retry limit is reached.
  // A campaign must never stop because of a fixable quality issue; blockers
  // that need business information the Director cannot invent become clear
  // user questions instead of a silent rejection.
  let workingStrategy = challengeResult.strategy;
  let workingOutputs = approvedOutputs;
  let workingBudget = buildDirectorBudgetFromStrategy(workingStrategy, briefText, campaignFacts);

  const maxAttempts = governanceMaxRepairAttempts();
  const repairLog: GovernanceRepairLogEntry[] = [];
  let attempts = 0;

  let clientTimeline = buildClientTimelineFromStrategy(workingStrategy);
  let reasoningBundle = buildIs1ReasoningBundle(campaignFacts, workingStrategy, {
    briefText,
    specialistOutputs: workingOutputs,
    debateResult,
  });
  let decisionIntelligenceGate!: ReturnType<typeof evaluateDecisionIntelligenceGate>;
  let approvalGate!: ReturnType<typeof evaluateApprovalGate>;
  let governanceResult!: ReturnType<typeof runGovernancePipeline>;

  for (;;) {
    clientTimeline = buildClientTimelineFromStrategy(workingStrategy);
    const timelineClientFacing = !clientTimeline.some((w) => isInternalTimelinePhase(w.phase));
    reasoningBundle = buildIs1ReasoningBundle(campaignFacts, workingStrategy, {
      briefText,
      specialistOutputs: workingOutputs,
      debateResult,
    });

    decisionIntelligenceGate = evaluateDecisionIntelligenceGate({
      facts: campaignFacts,
      strategy: workingStrategy,
      reasoning: reasoningBundle,
      budget: workingBudget,
      briefText,
    });

    approvalGate = evaluateApprovalGate({
      challenges: challengeResult.challenges,
      crossReviewFindings: challengeResult.crossReviewFindings,
      revisionRounds: challengeResult.revisionRounds,
      budgetValid: validateBudgetTotals100(workingBudget.allocations),
      timelineClientFacing,
    });

    if (!decisionIntelligenceGate.passed) {
      approvalGate = {
        ...approvalGate,
        approved: false,
        blockers: [...approvalGate.blockers, ...decisionIntelligenceGate.blockers],
      };
    }

    governanceResult = runGovernancePipeline({
      briefText,
      facts: campaignFacts,
      strategy: workingStrategy,
      specialistOutputs: workingOutputs,
      budget: workingBudget,
      timelineWeeks:
        clientTimeline.length || workingStrategy.understanding.timeline?.durationWeeks || 6,
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

    if (approvalGate.approved || attempts >= maxAttempts) break;

    const failing = collectFailingGovernanceChecks(governanceResult);
    const autoFixable = failing.filter(
      (check) => classifyGovernanceCheck(check) === "auto_fixable"
    );
    if (autoFixable.length === 0) break;

    const repair = repairGovernanceArtifacts(
      {
        briefText,
        facts: campaignFacts,
        strategy: workingStrategy,
        specialistOutputs: workingOutputs,
        budget: workingBudget,
      },
      autoFixable,
      attempts + 1
    );
    repairLog.push(...repair.log);
    for (const entry of repair.log) {
      console.log(
        `[governance-repair] attempt=${entry.attempt} check=${entry.checkId}` +
          `${entry.section ? ` section=${entry.section}` : ""} action="${entry.action}"`
      );
    }
    if (!repair.changed) break;

    workingStrategy = repair.artifacts.strategy;
    workingOutputs = repair.artifacts.specialistOutputs;
    workingBudget = repair.artifacts.budget;
    attempts += 1;
  }

  let finalFailing = approvalGate.approved
    ? []
    : collectFailingGovernanceChecks(governanceResult);

  // STAB-029: after repair exhaustion, polish-only residuals (medium/low
  // auto-fixables) must not block Studio release or escalate to INPUT REQUIRED.
  const governanceBlockerPattern =
    /Campaign QA Manager|Compliance gate|Presentation validator|governance check|Quality score|warnings exceed/i;
  const nonGovernanceBlockers = approvalGate.blockers.filter(
    (b) => !governanceBlockerPattern.test(b)
  );
  const polishOnlyResiduals =
    !approvalGate.approved &&
    decisionIntelligenceGate.passed &&
    finalFailing.length > 0 &&
    finalFailing.every((check) => !shouldAskUserForGovernanceCheck(check)) &&
    nonGovernanceBlockers.length === 0;
  if (polishOnlyResiduals) {
    console.log(
      `[governance-repair] soft-approving polish residuals: ${finalFailing
        .map((c) => c.id)
        .join(", ")}`
    );
    approvalGate = { ...approvalGate, approved: true, blockers: [] };
    finalFailing = [];
  }

  const userQuestions = approvalGate.approved
    ? []
    : buildGovernanceUserQuestions(finalFailing, approvalGate.blockers);
  const governanceRepair: GovernanceRepairSummary = {
    attempts,
    maxAttempts,
    log: repairLog,
    unresolved: finalFailing.map((check) => ({
      checkId: check.id,
      section: check.section,
      issue: check.issue,
      classification: classifyGovernanceCheck(check),
    })),
    userQuestions,
    outcome: approvalGate.approved
      ? attempts > 0
        ? "approved_after_repair"
        : "approved"
      : attempts >= maxAttempts &&
          finalFailing.some((check) => classifyGovernanceCheck(check) === "auto_fixable")
        ? "blocked_after_max_attempts"
        : "needs_user_input",
  };
  console.log(
    `[governance-repair] outcome=${governanceRepair.outcome} attempts=${attempts}` +
      `${approvalGate.approved ? "" : ` blockers=${JSON.stringify(approvalGate.blockers)}`}` +
      `${userQuestions.length > 0 ? ` questions=${userQuestions.length}` : ""}`
  );

  const approvedSections = buildApprovedSections(
    workingStrategy,
    workingOutputs,
    workingBudget,
    clientTimeline,
    approvalGate.approved,
    campaignFacts,
    briefText,
    reasoningBundle
  );

  return {
    strategyDocument: workingStrategy,
    specialistOutputs: workingOutputs,
    crossReviewFindings: challengeResult.crossReviewFindings,
    challenges: challengeResult.challenges,
    approvalGate,
    decisionIntelligenceGate,
    governance: governanceResult,
    governanceRepair,
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
