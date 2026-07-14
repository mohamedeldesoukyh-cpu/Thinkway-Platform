import type { AiOrchestrator } from "@/features/ai";
import type { AiContext, AiRequest } from "@/features/ai";
import type { ContextBuilderInput } from "@/features/ai/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { parseActionCardsFromResponse } from "@/features/ai-workspace/services/action-card-parser";
import type { AiActionCard } from "@/features/ai-workspace/types";
import { STUDIO_CREATOR_HYDRATION_LIMIT } from "@/features/campaign-studio/constants/hydration-limits";
import { normalizeCreators } from "../formatters/creator-formatter";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import type {
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  WorkflowProgressEvent,
  WorkflowState,
  WorkflowTaskResult,
} from "../types";
import {
  CAMPAIGN_REQUIRED_WORKFLOWS,
  extractCampaignQueryFromMessage,
  resolveCampaignByQuery,
} from "./campaign-resolver";
import {
  canRunTask,
  computeProgress,
  getNextTaskIndex,
  getRecommendedNextAction,
  mergeTaskResultIntoState,
  shouldAutoContinue,
} from "./continuation";
import {
  applyDisambiguationToState,
  enrichContextWithCampaign,
} from "./disambiguation";
import { runWorkflowTask } from "./task-runner";
import { formatWorkflowDashboard } from "../dashboard/workflow-dashboard";
import { workflowTrace } from "@/lib/creators/search-trace";
import {
  enrichWorkflowStateWithDirectorPipeline,
  injectDirectorStrategyIntoWorkflowState,
} from "@/features/campaign-director/integrations/workflow-integration";
import { initializeDirectorPipelineState, getCampaignFactsFromWorkflowData } from "@/features/campaign-director/services/campaign-director";
import {
  ensureWorkflowCampaignIntelligenceProfile,
  resolveWorkflowCampaignIntelligenceProfile,
} from "@/features/campaign-intelligence-profile/services/ensure-workflow-campaign-intelligence";
import { hasValidatedIntelligence } from "@/features/campaign-intelligence-profile/services/get-validated-intelligence";
import { normalizeCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/services/normalize-profile";
import { profileToCampaignFacts } from "@/features/campaign-intelligence-profile/services/profile-to-facts";
import { writeStrategyDocumentFromBrief } from "@/features/campaign-director/services/strategy-document";
import { mergeMissingCampaignFacts } from "@/features/campaign-director/facts/merge-campaign-facts";
import { formatGovernanceUserQuestions } from "@/features/campaign-governance/governance-repair";

export type WorkflowEngineOptions = {
  orchestrator: AiOrchestrator;
  supabase?: SupabaseClient;
  contextInput?: Omit<ContextBuilderInput, "request">;
  onProgress?: (event: WorkflowProgressEvent) => void;
  /** Skip LLM execution (for validation/dry-run). */
  dryRun?: boolean;
  /** Resume from a paused workflow state instead of starting fresh. */
  initialState?: WorkflowState;
  /** Task index to start/resume from (defaults to 0). */
  startTaskIndex?: number;
};

function createInitialState(definition: WorkflowDefinition): WorkflowState {
  return {
    workflowId: definition.id,
    workflowName: definition.name,
    currentTaskIndex: 0,
    taskResults: {},
    data: {},
    status: "running",
  };
}

function buildExecutionContext(
  definition: WorkflowDefinition,
  state: WorkflowState,
  request: AiRequest,
  aiContext: AiContext,
  resolvedCampaignId?: string,
  resolvedCampaignName?: string
): WorkflowExecutionContext {
  return {
    request,
    aiContext,
    state,
    definition,
    resolvedCampaignId,
    resolvedCampaignName,
    userMessage: request.message,
  };
}

function taskResultFromOutput(
  taskId: string,
  output: Awaited<ReturnType<typeof runWorkflowTask>>
): WorkflowTaskResult {
  const now = new Date().toISOString();
  if (!output.success) {
    const isApproval =
      output.structured &&
      hasMutatingToolOutput(output.structured);

    return {
      taskId,
      status: isApproval ? "awaiting_approval" : "blocked",
      agentId: output.agentId,
      content: output.content,
      structured: output.structured,
      toolsUsed: output.toolsUsed,
      error: output.error,
      startedAt: now,
      completedAt: now,
    };
  }

  return {
    taskId,
    status: "completed",
    agentId: output.agentId,
    content: output.content,
    structured: output.structured,
    toolsUsed: output.toolsUsed,
    startedAt: now,
    completedAt: now,
  };
}

function hasMutatingToolOutput(structured: Record<string, unknown>): boolean {
  const outputs = structured.toolOutputs as
    | Array<{ tool: string; output: unknown }>
    | undefined;
  return (
    outputs?.some(
      (o) =>
        (o.tool === "buildCampaign" || o.tool === "createShortlist") && o.output
    ) ?? false
  );
}

function enrichActionCardsFromState(
  cards: AiActionCard[],
  state: WorkflowState
): AiActionCard[] {
  const facts = state.data.campaignFacts as CampaignFacts | undefined;
  const preferredPlatforms = facts?.platforms;
  const currency = facts?.budget?.currency;
  const searchResults = normalizeCreators(state.data.searchResults, "actionCards").slice(
    0,
    STUDIO_CREATOR_HYDRATION_LIMIT
  );

  if (searchResults.length === 0) return cards;

  const creatorPayload = {
    creators: searchResults,
    creatorIds: searchResults.map((c) => c.id),
    preferredPlatforms,
    currency,
    total: typeof state.data.searchTotal === "number" ? state.data.searchTotal : searchResults.length,
  };

  return cards.map((card) => {
    if (card.type === "creator_search" || (card.type === "campaign" && card.requiresApproval)) {
      return {
        ...card,
        payload: {
          ...card.payload,
          ...creatorPayload,
        },
      };
    }
    return card;
  });
}

function dedupeActionCards(cards: AiActionCard[]): AiActionCard[] {
  const seen = new Set<string>();
  const next: AiActionCard[] = [];

  for (const card of cards) {
    const key =
      card.type === "campaign"
        ? "campaign"
        : card.type === "creator_search"
          ? "creator_search"
          : `${card.type}:${card.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(card);
  }

  return next;
}

function collectActionCards(
  state: WorkflowState,
  latestStructured?: Record<string, unknown>,
  latestAgentId?: string
): AiActionCard[] {
  const cards: AiActionCard[] = [];

  for (const result of Object.values(state.taskResults)) {
    if (result.structured) {
      const mockResponse = {
        id: `wf_${result.taskId}`,
        requestId: `wf_req_${result.taskId}`,
        conversationId: "",
        content: result.content ?? "",
        structured: result.structured,
        metadata: { agentId: result.agentId ?? "general" },
      };
      cards.push(...parseActionCardsFromResponse(mockResponse));
    }
  }

  if (latestStructured) {
    const mockResponse = {
      id: "wf_latest",
      requestId: "wf_req_latest",
      conversationId: "",
      content: "",
      structured: latestStructured,
      metadata: { agentId: latestAgentId ?? "general" },
    };
    const latestCards = parseActionCardsFromResponse(mockResponse);
    for (const card of latestCards) {
      if (!cards.some((c) => c.type === card.type && c.title === card.title)) {
        cards.push(card);
      }
    }
  }

  return enrichActionCardsFromState(dedupeActionCards(cards), state);
}

/**
 * Main workflow engine executor.
 * Runs multi-step workflows by calling existing orchestrator for each task.
 */
const LIFECYCLE_TASK_STAGES: Record<string, string> = {
  "analyze-request": "Analyze",
  "build-strategy": "Strategy",
  "estimate-budget": "Analyst",
  "search-creators": "Scout",
  "generate-timeline": "Planner",
};

export async function executeWorkflow(
  definition: WorkflowDefinition,
  request: AiRequest,
  aiContext: AiContext,
  options: WorkflowEngineOptions
): Promise<WorkflowExecutionResult> {
  console.log("[workflow-lifecycle] Workflow starts started");

  const state = options.initialState
    ? {
        ...options.initialState,
        status: "running" as const,
        pauseReason: undefined,
        pauseMessage: undefined,
      }
    : createInitialState(definition);

  if (definition.id === "create-campaign" && !state.data.campaignStrategyDocument) {
    let intelligenceProfileId = state.data.campaignIntelligenceProfileId as string | undefined;
    let campaignFacts: CampaignFacts | undefined;
    let strategyDocument;

    if (!intelligenceProfileId && request.conversationId && options.supabase && aiContext.user?.id) {
      const brandHint = initializeDirectorPipelineState(request.message).campaignFacts.brandName;
      const resolved = await resolveWorkflowCampaignIntelligenceProfile(options.supabase, {
        conversationId: request.conversationId,
        userId: aiContext.user.id,
        brandName: brandHint,
      });
      if (resolved) {
        const profile = normalizeCampaignIntelligenceProfile(resolved.profile);
        if (hasValidatedIntelligence(profile)) {
          intelligenceProfileId = resolved.id;
          campaignFacts = profileToCampaignFacts(profile);
          strategyDocument = writeStrategyDocumentFromBrief(
            {
              rawMessage: profile.rawBriefExcerpt ?? request.message,
              brandName: campaignFacts.brandName,
              campaignFacts,
            },
            campaignFacts
          );
        }
      }
    }

    if (!strategyDocument) {
      const initialized = initializeDirectorPipelineState(request.message);
      strategyDocument = initialized.strategyDocument;
      campaignFacts = initialized.campaignFacts;
    }

    const facts = campaignFacts!;

    if (intelligenceProfileId) {
      state.data.campaignIntelligenceProfileId = intelligenceProfileId;
    }

    injectDirectorStrategyIntoWorkflowState(state, strategyDocument);
    state.data.campaignFacts = facts;
    state.data.brandName =
      state.data.brandName ?? facts.brandName ?? strategyDocument.understanding.brand;
    if (facts.budget?.currency) {
      state.data.currency = facts.budget.currency;
    } else if (strategyDocument.understanding.budget?.currency) {
      state.data.currency = strategyDocument.understanding.budget.currency;
    }
    if (facts.budget?.amount) {
      state.data.budgetTotal = facts.budget.amount;
    } else if (strategyDocument.understanding.budget?.amount) {
      state.data.budgetTotal = strategyDocument.understanding.budget.amount;
    }
  }

  // Governance resume: a paused create-campaign asked the user for missing
  // business facts (budget, brand, objective…). The resume message carries the
  // answer — fill ONLY the missing facts so all completed work is preserved.
  if (
    definition.id === "create-campaign" &&
    options.initialState &&
    state.data.campaignStrategyDocument &&
    state.data.campaignFacts
  ) {
    const merged = mergeMissingCampaignFacts(
      state.data.campaignFacts as CampaignFacts,
      request.message
    );
    if (merged.filledFields.length > 0) {
      state.data.campaignFacts = merged.facts;
      if (!state.data.brandName && merged.facts.brandName) {
        state.data.brandName = merged.facts.brandName;
      }
      if (merged.facts.budget) {
        state.data.currency = merged.facts.budget.currency;
        state.data.budgetTotal = merged.facts.budget.amount;
      }
      console.log(
        `[governance-repair] resume filled missing facts: ${merged.filledFields.join(", ")}`
      );
    }
  }

  let effectiveAiContext = aiContext;
  if (typeof state.data.campaignIntelligenceProfileId === "string") {
    effectiveAiContext = {
      ...effectiveAiContext,
      campaignIntelligenceProfileId: state.data.campaignIntelligenceProfileId,
    };
  }

  let resolvedCampaignId =
    (state.data.campaignId as string | undefined) ?? aiContext.campaign?.id;
  let resolvedCampaignName =
    (state.data.campaignName as string | undefined) ?? aiContext.campaign?.name;

  if (
    options.supabase &&
    CAMPAIGN_REQUIRED_WORKFLOWS.has(definition.id) &&
    !resolvedCampaignId
  ) {
    const query =
      extractCampaignQueryFromMessage(request.message) ?? request.message;
    const resolution = await resolveCampaignByQuery(options.supabase, query);

    if (resolution.needsDisambiguation) {
      applyDisambiguationToState(state, resolution.candidates);
      const dashboard = formatWorkflowDashboard({
        state,
        actionCards: [],
        pauseReason: "disambiguation",
        pauseMessage: state.pauseMessage,
      });
      return buildResult(state, definition, dashboard.content, [], dashboard.metadata);
    }

    if (resolution.resolved) {
      resolvedCampaignId = resolution.resolved.id;
      resolvedCampaignName = resolution.resolved.name;
      state.data.campaignId = resolvedCampaignId;
      state.data.campaignName = resolvedCampaignName;
    }
  }

  let ctx = buildExecutionContext(
    definition,
    state,
    request,
    effectiveAiContext,
    resolvedCampaignId,
    resolvedCampaignName
  );

  const totalTasks = definition.tasks.length;
  let taskIndex = options.startTaskIndex ?? 0;

  console.log("[workflow-lifecycle] Workflow starts completed");

  while (taskIndex < totalTasks) {
    const task = definition.tasks[taskIndex];
    state.currentTaskIndex = taskIndex;

    const check = canRunTask(task, ctx);
    if (!check.canRun && check.reason === "skip") {
      state.taskResults[task.id] = {
        taskId: task.id,
        status: "skipped",
        completedAt: new Date().toISOString(),
      };
      taskIndex = getNextTaskIndex(definition, taskIndex, ctx);
      continue;
    }

    options.onProgress?.({
      workflowId: definition.id,
      step: taskIndex + 1,
      totalSteps: totalTasks,
      taskId: task.id,
      taskTitle: task.title,
      status: "running",
      progress: computeProgress(state, totalTasks),
    });

    const lifecycleStage = LIFECYCLE_TASK_STAGES[task.id];
    if (lifecycleStage) {
      console.log(`[workflow-lifecycle] ${lifecycleStage} started`);
    }

    if (task.id === "search-creators" && definition.id === "create-campaign") {
      // Drop spurious early searches (e.g. strategist probing "** Audience") so CIP discovery wins.
      delete state.data.searchExecuted;
      delete state.data.searchResults;
      delete state.data.searchTotal;
      delete state.data.rankedCreators;
    }

    if (
      task.id === "search-creators" &&
      definition.id === "create-campaign" &&
      options.supabase &&
      request.conversationId &&
      aiContext.user?.id
    ) {
      const ensuredProfileId = await ensureWorkflowCampaignIntelligenceProfile(
        options.supabase,
        {
          conversationId: request.conversationId,
          userId: aiContext.user.id,
          briefText: request.message,
          existingProfileId: state.data.campaignIntelligenceProfileId as
            | string
            | undefined,
          brandId:
            typeof state.data.brandId === "string" ? state.data.brandId : undefined,
          brandName:
            typeof state.data.brandName === "string"
              ? state.data.brandName
              : getCampaignFactsFromWorkflowData(state.data)?.brandName,
        }
      );
      if (ensuredProfileId) {
        state.data.campaignIntelligenceProfileId = ensuredProfileId;
        effectiveAiContext = {
          ...effectiveAiContext,
          campaignIntelligenceProfileId: ensuredProfileId,
        };
      }
    }

    let result: WorkflowTaskResult;

    if (options.dryRun) {
      result = {
        taskId: task.id,
        status: "completed",
        agentId: task.agent,
        content: `[Dry run] ${task.title}`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    } else {
      const prompt = task.buildPrompt(ctx);
      const output = await runWorkflowTask(
        options.orchestrator,
        {
          taskId: task.id,
          agent: task.agent,
          intent: task.intent,
          message: prompt,
          userMessage: ctx.userMessage,
          conversationId: request.conversationId,
          context: effectiveAiContext,
          workflowData: state.data,
        },
        {
          ...options.contextInput,
          campaignIntelligenceProfileId:
            effectiveAiContext.campaignIntelligenceProfileId ??
            (typeof state.data.campaignIntelligenceProfileId === "string"
              ? state.data.campaignIntelligenceProfileId
              : options.contextInput?.campaignIntelligenceProfileId),
        }
      );
      result = taskResultFromOutput(task.id, output);
    }

    if (lifecycleStage) {
      console.log(`[workflow-lifecycle] ${lifecycleStage} completed`);
    }

    mergeTaskResultIntoState(state, task, result);

    workflowTrace("7_workflowEngine_state", { data: state.data }, "workflowState", {
      taskId: task.id,
      taskIndex,
    });

    options.onProgress?.({
      workflowId: definition.id,
      step: taskIndex + 1,
      totalSteps: totalTasks,
      taskId: task.id,
      taskTitle: task.title,
      status: result.status,
      progress: computeProgress(state, totalTasks),
    });

    const continuation = shouldAutoContinue(task, result, state);
    if (!continuation.shouldContinue) {
      state.status = "paused";
      state.pauseReason = continuation.reason;
      state.pauseMessage = continuation.message;
      break;
    }

    taskIndex = getNextTaskIndex(definition, taskIndex, ctx);
    ctx = buildExecutionContext(
      definition,
      state,
      request,
      effectiveAiContext,
      resolvedCampaignId,
      resolvedCampaignName
    );
  }

  if (state.status === "running" && taskIndex >= totalTasks) {
    state.status = "completed";
  }

  if (definition.id === "create-campaign" && state.status === "completed") {
    const pipelineResult = enrichWorkflowStateWithDirectorPipeline(
      state,
      request.message,
      state.data.brandName as string | undefined,
      state.data.campaignFacts as CampaignFacts | undefined
    );

    // Governance could not approve and needs business information the Director
    // must not invent: pause with clear, specific questions instead of leaving
    // Studio with silently discarded sections. missing_info pauses persist in
    // the conversation snapshot, so the user's answer resumes this workflow.
    const questions = pipelineResult.governanceRepair?.userQuestions ?? [];
    if (!pipelineResult.approvalGate.approved && questions.length > 0) {
      state.status = "paused";
      state.pauseReason = "missing_info";
      state.pauseMessage = formatGovernanceUserQuestions(questions);
    }
  }

  const actionCards = collectActionCards(
    state,
    state.taskResults[definition.tasks[state.currentTaskIndex]?.id]?.structured,
    state.taskResults[definition.tasks[state.currentTaskIndex]?.id]?.agentId
  );

  const dashboard = formatWorkflowDashboard({ state, actionCards });
  const recommended = getRecommendedNextAction(state, definition);

  return buildResult(
    state,
    definition,
    dashboard.content,
    actionCards,
    { ...dashboard.metadata, recommendedNextAction: recommended }
  );
}

function buildResult(
  state: WorkflowState,
  definition: WorkflowDefinition,
  dashboardContent: string,
  actionCards: AiActionCard[],
  metadata: WorkflowExecutionResult["metadata"]
): WorkflowExecutionResult {
  const completedTasks = definition.tasks
    .filter((t) => state.taskResults[t.id]?.status === "completed")
    .map((t) => t.title);

  const pendingTasks = definition.tasks
    .filter(
      (t) =>
        !state.taskResults[t.id] ||
        state.taskResults[t.id].status === "pending" ||
        state.taskResults[t.id].status === "running"
    )
    .map((t) => t.title);

  return {
    success: state.status !== "failed",
    state,
    dashboardContent,
    actionCards,
    metadata: {
      ...metadata,
      completedTasks,
      pendingTasks,
    },
  };
}

/** Resume a paused workflow after disambiguation, approval, or clarification. */
export async function resumeWorkflow(
  definition: WorkflowDefinition,
  state: WorkflowState,
  request: AiRequest,
  aiContext: AiContext,
  options: WorkflowEngineOptions
): Promise<WorkflowExecutionResult> {
  const currentTask = definition.tasks[state.currentTaskIndex];
  const currentResult = currentTask ? state.taskResults[currentTask.id] : undefined;

  let startTaskIndex = state.currentTaskIndex;

  if (
    currentResult?.status === "blocked" &&
    state.pauseReason === "missing_info" &&
    currentTask
  ) {
    delete state.taskResults[currentTask.id];
    startTaskIndex = state.currentTaskIndex;
  } else if (currentResult?.status === "completed") {
    startTaskIndex = state.currentTaskIndex + 1;
  }

  if (startTaskIndex >= definition.tasks.length) {
    // All tasks already completed — route through executeWorkflow with an
    // empty task window so completion finalization still runs (create-campaign
    // Director pipeline, governance self-repair, pause-for-missing-info).
    // Returning early here would skip finalization and strand a governance
    // pause that was waiting for the user's answer.
    return executeWorkflow(definition, request, aiContext, {
      ...options,
      initialState: state,
      startTaskIndex: definition.tasks.length,
    });
  }

  let resolvedCampaignId =
    (state.data.campaignId as string | undefined) ?? aiContext.campaign?.id;
  let resolvedCampaignName =
    (state.data.campaignName as string | undefined) ?? aiContext.campaign?.name;

  if (state.disambiguationOptions && options.supabase) {
    const selectedId = state.data.selectedCampaignId as string | undefined;
    if (selectedId) {
      resolvedCampaignId = selectedId;
      const option = state.disambiguationOptions.find((o) => o.id === selectedId);
      resolvedCampaignName = option?.label;
      state.data.campaignId = resolvedCampaignId;
      state.data.campaignName = resolvedCampaignName;
    }
  }

  return executeWorkflow(definition, request, aiContext, {
    ...options,
    initialState: state,
    startTaskIndex,
  });
}

export { enrichContextWithCampaign };
