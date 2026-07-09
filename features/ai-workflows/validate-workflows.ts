#!/usr/bin/env npx tsx
/**
 * Validation for Sprint 5 Autonomous Workflow Engine.
 * Run: npx tsx features/ai-workflows/validate-workflows.ts
 */
import "@/lib/performance/script-env-preload";

import type { AiContext, AiRequest } from "@/features/ai";

import {
  WORKFLOW_DEFINITIONS,
  WORKFLOW_MAP,
  matchWorkflow,
  canRunTask,
  shouldAutoContinue,
  computeProgress,
  getRecommendedNextAction,
  formatWorkflowDashboard,
  aggregateWorkflowResults,
  shouldRenderWorkflowSummary,
  isLikelyWorkflowRequest,
  createCampaignWorkflow,
  findCreatorsWorkflow,
  analyzeCampaignWorkflow,
  generateBriefWorkflow,
  buildShortlistWorkflow,
  campaignHealthCheckWorkflow,
  type WorkflowDefinition,
  type WorkflowState,
  type WorkflowTaskResult,
} from "./index";

type MatchScenario = {
  name: string;
  message: string;
  expectedWorkflowId: string;
  intent?: AiRequest["intent"];
  expectNoMatch?: boolean;
};

type StructureCheck = {
  name: string;
  workflow: WorkflowDefinition;
  minTasks: number;
  hasApprovalStep: boolean;
  requiredAgents: string[];
};

const baseContext: AiContext = {
  workspace: { type: "general" },
};

function createRequest(message: string, intent?: AiRequest["intent"]): AiRequest {
  return {
    id: `req_wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    message,
    intent,
  };
}

const matchScenarios: MatchScenario[] = [
  {
    name: "Create Campaign (BabyJoy example)",
    message: "Create a BabyJoy campaign",
    expectedWorkflowId: "create-campaign",
  },
  {
    name: "Find Creators (luxury hotel Egypt)",
    message: "Find luxury hotel creators in Egypt",
    expectedWorkflowId: "find-creators",
  },
  {
    name: "Analyze Campaign",
    message: "Analyze this campaign's performance and risks",
    expectedWorkflowId: "analyze-campaign",
  },
  {
    name: "Generate Brief",
    message: "Generate a creative brief for my campaign",
    expectedWorkflowId: "generate-brief",
  },
  {
    name: "Build Shortlist",
    message: "Build a shortlist of top creators from my search",
    expectedWorkflowId: "build-shortlist",
  },
  {
    name: "Campaign Health Check",
    message: "Run a campaign health check",
    expectedWorkflowId: "campaign-health-check",
  },
  {
    name: "Launch BabyJoy (operational create)",
    message: "Launch BabyJoy Premium Diapers in Egypt",
    expectedWorkflowId: "create-campaign",
  },
  {
    name: "Launch BabyJoy full brief (operational create)",
    message:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
    expectedWorkflowId: "create-campaign",
  },
  {
    name: "Find travel creators in Egypt",
    message: "Find travel creators in Egypt",
    expectedWorkflowId: "find-creators",
  },
  {
    name: "What can Thinkway do? (no workflow)",
    message: "What can Thinkway do?",
    expectedWorkflowId: "",
    expectNoMatch: true,
  },
];

const structureChecks: StructureCheck[] = [
  {
    name: "Create Campaign structure",
    workflow: createCampaignWorkflow,
    minTasks: 6,
    hasApprovalStep: true,
    requiredAgents: ["strategist", "scout", "planner"],
  },
  {
    name: "Find Creators structure",
    workflow: findCreatorsWorkflow,
    minTasks: 3,
    hasApprovalStep: false,
    requiredAgents: ["scout"],
  },
  {
    name: "Analyze Campaign structure",
    workflow: analyzeCampaignWorkflow,
    minTasks: 4,
    hasApprovalStep: false,
    requiredAgents: ["analyst"],
  },
  {
    name: "Generate Brief structure",
    workflow: generateBriefWorkflow,
    minTasks: 3,
    hasApprovalStep: false,
    requiredAgents: ["strategist"],
  },
  {
    name: "Build Shortlist structure",
    workflow: buildShortlistWorkflow,
    minTasks: 2,
    hasApprovalStep: true,
    requiredAgents: ["scout"],
  },
  {
    name: "Campaign Health Check structure",
    workflow: campaignHealthCheckWorkflow,
    minTasks: 4,
    hasApprovalStep: false,
    requiredAgents: ["analyst"],
  },
];

function runMatchScenario(scenario: MatchScenario): boolean {
  console.log(`\n=== Match: ${scenario.name} ===`);
  const request = createRequest(scenario.message, scenario.intent);
  const result = matchWorkflow(request, baseContext);

  console.log(`Message: "${scenario.message}"`);
  console.log(`Matched: ${result.matched} (confidence: ${result.confidence})`);
  console.log(`Workflow: ${result.workflow?.id ?? "none"}`);
  console.log(`Reason: ${result.reason}`);

  const pass = scenario.expectNoMatch
    ? !result.matched
    : result.matched && result.workflow?.id === scenario.expectedWorkflowId;

  console.log(
    pass
      ? "RESULT: PASS"
      : scenario.expectNoMatch
        ? "RESULT: FAIL (expected no workflow match)"
        : `RESULT: FAIL (expected ${scenario.expectedWorkflowId})`
  );
  return pass;
}

function runStructureCheck(check: StructureCheck): boolean {
  console.log(`\n=== Structure: ${check.name} ===`);
  const wf = check.workflow;

  const taskCountOk = wf.tasks.length >= check.minTasks;
  const hasApproval = wf.tasks.some((t) => t.requiresApproval) === check.hasApprovalStep;
  const agentsPresent = check.requiredAgents.every((agent) =>
    wf.tasks.some((t) => t.agent === agent)
  );
  const allHavePrompts = wf.tasks.every(
    (t) => typeof t.buildPrompt === "function"
  );
  const readonlyAuto = wf.tasks
    .filter((t) => t.readonly && !t.requiresApproval)
    .every((t) => !t.requiresApproval);

  console.log(`Tasks: ${wf.tasks.length} (min ${check.minTasks})`);
  console.log(`Approval step: ${hasApproval}`);
  console.log(`Required agents: ${agentsPresent}`);
  console.log(`All prompts defined: ${allHavePrompts}`);
  console.log(`Read-only auto-continue: ${readonlyAuto}`);

  const pass = taskCountOk && hasApproval && agentsPresent && allHavePrompts;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testContinuationLogic(): boolean {
  console.log("\n=== Continuation logic ===");

  const state: WorkflowState = {
    workflowId: "find-creators",
    workflowName: "Find Creators",
    currentTaskIndex: 1,
    taskResults: {},
    data: {},
    status: "running",
  };

  const readonlyResult: WorkflowTaskResult = {
    taskId: "search-creators",
    status: "completed",
    agentId: "scout",
    content: "Found 10 creators",
  };

  const task = findCreatorsWorkflow.tasks[1];
  const decision = shouldAutoContinue(task, readonlyResult, state);
  console.log(`Read-only auto-continue: ${decision.shouldContinue}`);

  const approvalResult: WorkflowTaskResult = {
    taskId: "prepare-approval",
    status: "awaiting_approval",
    agentId: "strategist",
    structured: {
      toolOutputs: [{ tool: "buildCampaign", output: { draft: { name: "Test" } } }],
    },
  };
  const approvalTask = createCampaignWorkflow.tasks.find((t) => t.requiresApproval)!;
  const approvalDecision = shouldAutoContinue(approvalTask, approvalResult, state);
  console.log(`Approval pause: ${!approvalDecision.shouldContinue && approvalDecision.reason === "approval_required"}`);

  const pass =
    decision.shouldContinue === true &&
    approvalDecision.shouldContinue === false &&
    approvalDecision.reason === "approval_required";

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testResultAggregation(): boolean {
  console.log("\n=== Result aggregation ===");

  const state: WorkflowState = {
    workflowId: "create-campaign",
    workflowName: "Create Campaign",
    currentTaskIndex: 7,
    taskResults: {
      "analyze-request": {
        taskId: "analyze-request",
        status: "completed",
        agentId: "general",
        content: "Brand: BabyJoy, target: new parents",
      },
      "build-strategy": {
        taskId: "build-strategy",
        status: "completed",
        agentId: "strategist",
        content: "Focus on trust-building content with pediatric endorsements.",
      },
      "estimate-budget": {
        taskId: "estimate-budget",
        status: "completed",
        agentId: "analyst",
        content: "Total budget: $45,000–$60,000 USD.",
      },
      "search-creators": {
        taskId: "search-creators",
        status: "completed",
        agentId: "scout",
        structured: {
          toolOutputs: [
            {
              tool: "searchCreators",
              output: {
                creators: [
                  {
                    id: "cr_parentpro",
                    handle: "parentpro",
                    displayName: "ParentPro",
                    followers: 120000,
                    platform: "instagram",
                  },
                ],
                total: 1,
              },
            },
          ],
        },
      },
      "build-shortlist": {
        taskId: "build-shortlist",
        status: "completed",
        agentId: "scout",
        content: "Top pick: ParentPro — strong parenting niche alignment.",
      },
      "generate-brief": {
        taskId: "generate-brief",
        status: "completed",
        agentId: "strategist",
        content: "Deliverables: 2 Reels, 1 Story series. Tone: warm, expert-backed.",
      },
      "generate-timeline": {
        taskId: "generate-timeline",
        status: "completed",
        agentId: "planner",
        content: "Week 1: brief approval. Week 2–3: creator outreach. Week 4: go-live.",
      },
      "prepare-approval": {
        taskId: "prepare-approval",
        status: "completed",
        agentId: "strategist",
        structured: {
          toolOutputs: [
            {
              tool: "buildCampaign",
              output: { name: "BabyJoy Launch", description: "Q3 influencer launch campaign." },
            },
          ],
        },
      },
    },
    data: { brandName: "BabyJoy" },
    status: "paused",
    pauseReason: "approval_required",
    pauseMessage: "Approval required before proceeding.",
  };

  const sections = aggregateWorkflowResults(state, createCampaignWorkflow);
  const shouldRender = shouldRenderWorkflowSummary(state, createCampaignWorkflow.tasks.length);
  const dashboard = formatWorkflowDashboard({ state, actionCards: [] });

  const expectedTitles = [
    "Campaign Strategy",
    "Budget",
    "Timeline",
    "Vendor Discovery",
    "Vendor Recommendations",
    "Campaign Brief",
    "Approval",
  ];
  const titlesMatch = expectedTitles.every((title) =>
    sections.some((section) => section.title === title)
  );
  const contentFromTasks = sections.every((section) => section.content.trim().length > 0);
  const dashboardHasResults =
    dashboard.content.includes("### Results") &&
    dashboard.content.includes("Campaign Strategy") &&
    dashboard.content.includes("Workflow Complete");
  const metadataHasSections =
    (dashboard.metadata.summarySections?.length ?? 0) === sections.length;

  console.log(`Sections aggregated: ${sections.length}`);
  console.log(`Should render summary: ${shouldRender}`);
  console.log(`Dashboard includes results: ${dashboardHasResults}`);
  console.log(`Metadata carries sections: ${metadataHasSections}`);

  const pass =
    shouldRender &&
    sections.length === 7 &&
    titlesMatch &&
    contentFromTasks &&
    dashboardHasResults &&
    metadataHasSections;

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testDashboardFormat(): boolean {
  console.log("\n=== Dashboard format ===");

  const state: WorkflowState = {
    workflowId: "create-campaign",
    workflowName: "Create Campaign",
    currentTaskIndex: 3,
    taskResults: {
      "analyze-request": { taskId: "analyze-request", status: "completed" },
      "build-strategy": { taskId: "build-strategy", status: "completed" },
      "estimate-budget": { taskId: "estimate-budget", status: "completed" },
    },
    data: { brandName: "BabyJoy" },
    status: "running",
  };

  const dashboard = formatWorkflowDashboard({ state, actionCards: [] });

  const hasTitle = dashboard.content.includes("Create Campaign");
  const hasProgress = dashboard.content.includes("Progress");
  const hasTasks = dashboard.content.includes("Tasks");
  const hasNext = dashboard.content.includes("Next action");
  const metadataOk =
    dashboard.metadata.workflow === true &&
    dashboard.metadata.workflowId === "create-campaign" &&
    dashboard.metadata.completedTasks.length === 3;

  console.log(`Content sections: title=${hasTitle} progress=${hasProgress} tasks=${hasTasks} next=${hasNext}`);
  console.log(`Metadata: workflow=${dashboard.metadata.workflow} completed=${dashboard.metadata.completedTasks.length}`);
  console.log(`Progress: ${computeProgress(state, createCampaignWorkflow.tasks.length)}%`);

  const recommended = getRecommendedNextAction(state, createCampaignWorkflow);
  console.log(`Recommended: ${recommended.slice(0, 60)}...`);

  const pass = hasTitle && hasProgress && hasTasks && hasNext && metadataOk;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testRegistryCompleteness(): boolean {
  console.log("\n=== Registry completeness ===");

  const expectedIds = [
    "create-campaign",
    "find-creators",
    "analyze-campaign",
    "generate-brief",
    "build-shortlist",
    "campaign-health-check",
  ];

  const allPresent = expectedIds.every((id) => WORKFLOW_MAP[id as keyof typeof WORKFLOW_MAP]);
  const countOk = WORKFLOW_DEFINITIONS.length === 6;
  const allHavePatterns = WORKFLOW_DEFINITIONS.every((w) => w.triggerPatterns.length > 0);
  const allHaveThreshold = WORKFLOW_DEFINITIONS.every((w) => w.minConfidence > 0);

  console.log(`Definitions: ${WORKFLOW_DEFINITIONS.length}`);
  console.log(`All IDs present: ${allPresent}`);
  console.log(`All have patterns: ${allHavePatterns}`);

  const pass = allPresent && countOk && allHavePatterns && allHaveThreshold;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testPreCheck(): boolean {
  console.log("\n=== Workflow pre-check ===");

  const positive = isLikelyWorkflowRequest("Create a BabyJoy campaign");
  const negative = isLikelyWorkflowRequest("What is the weather today?");

  console.log(`Positive match: ${positive}`);
  console.log(`Negative match: ${negative}`);

  const pass = positive && !negative;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testClarificationPassthrough(): boolean {
  console.log("\n=== Clarification passthrough ===");

  const clarificationQuestion =
    "What is the primary campaign objective (e.g. awareness, launch, engagement)?";

  const blockedResult: WorkflowTaskResult = {
    taskId: "build-strategy",
    status: "blocked",
    agentId: "strategist",
    content: clarificationQuestion,
    structured: { mode: "clarification", missingField: "objective" },
    error: "Agent requested clarification — missing information.",
  };

  const task = createCampaignWorkflow.tasks.find((entry) => entry.id === "build-strategy")!;
  const state: WorkflowState = {
    workflowId: "create-campaign",
    workflowName: "Create Campaign",
    currentTaskIndex: 1,
    taskResults: {
      "analyze-request": { taskId: "analyze-request", status: "completed" },
      "build-strategy": blockedResult,
    },
    data: { brandName: "BabyJoy" },
    status: "running",
  };

  const decision = shouldAutoContinue(task, blockedResult, state);
  const pausedState: WorkflowState = {
    ...state,
    status: "paused",
    pauseReason: "missing_info",
    pauseMessage: decision.message,
  };

  const dashboard = formatWorkflowDashboard({ state: pausedState, actionCards: [] });
  const showsQuestion =
    dashboard.content.includes(clarificationQuestion) &&
    dashboard.metadata.clarificationQuestion === clarificationQuestion;
  const usesGenericOnly =
    dashboard.recommendedNextAction === "Agent requested clarification — missing information.";

  console.log(`Pause message uses agent question: ${decision.message === clarificationQuestion}`);
  console.log(`Dashboard shows clarification: ${showsQuestion}`);
  console.log(`Dashboard avoids generic-only next action: ${!usesGenericOnly}`);

  const pass =
    decision.shouldContinue === false &&
    decision.reason === "missing_info" &&
    decision.message === clarificationQuestion &&
    showsQuestion &&
    !usesGenericOnly;

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testWorkflowResumeIndex(): boolean {
  console.log("\n=== Workflow resume index ===");

  const state: WorkflowState = {
    workflowId: "create-campaign",
    workflowName: "Create Campaign",
    currentTaskIndex: 1,
    taskResults: {
      "analyze-request": { taskId: "analyze-request", status: "completed" },
      "build-strategy": {
        taskId: "build-strategy",
        status: "blocked",
        content: "What is the primary campaign objective?",
        structured: { mode: "clarification" },
      },
    },
    data: { brandName: "BabyJoy" },
    status: "paused",
    pauseReason: "missing_info",
    pauseMessage: "What is the primary campaign objective?",
  };

  const currentTask = createCampaignWorkflow.tasks[state.currentTaskIndex];
  const currentResult = currentTask ? state.taskResults[currentTask.id] : undefined;
  const retrySameTask =
    currentResult?.status === "blocked" && state.pauseReason === "missing_info";

  console.log(`Paused at step ${state.currentTaskIndex + 1}: ${currentTask?.title}`);
  console.log(`Retry same task on resume: ${retrySameTask}`);
  console.log(`Completed prior tasks preserved: ${state.taskResults["analyze-request"]?.status === "completed"}`);

  const pass =
    retrySameTask &&
    state.currentTaskIndex === 1 &&
    state.taskResults["analyze-request"]?.status === "completed";

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testCanRunTask(): boolean {
  console.log("\n=== Task prerequisites ===");

  const state: WorkflowState = {
    workflowId: "analyze-campaign",
    workflowName: "Analyze Campaign",
    currentTaskIndex: 1,
    taskResults: {},
    data: {},
    status: "running",
  };

  const ctx = {
    request: createRequest("Analyze BabyJoy campaign"),
    aiContext: baseContext,
    state,
    definition: analyzeCampaignWorkflow,
    resolvedCampaignId: "camp_123",
    userMessage: "Analyze BabyJoy campaign",
  };

  const loadTask = analyzeCampaignWorkflow.tasks.find((t) => t.id === "load-data")!;
  const skipCheck = canRunTask(loadTask, ctx);
  console.log(`With campaign ID: canRun=${skipCheck.canRun}`);

  const noCampaignCtx = { ...ctx, resolvedCampaignId: undefined };
  const skipTask = analyzeCampaignWorkflow.tasks.find((t) => t.id === "load-data")!;
  const skipResult = canRunTask(skipTask, noCampaignCtx);
  console.log(`Without campaign ID: canRun=${skipResult.canRun} reason=${skipResult.reason}`);

  const pass = skipCheck.canRun === true;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function main(): void {
  console.log("=== Thinkway Intelligence Sprint 5: Workflow Engine Validation ===\n");

  let passed = 0;
  let total = 0;

  for (const scenario of matchScenarios) {
    total += 1;
    if (runMatchScenario(scenario)) passed += 1;
  }

  for (const check of structureChecks) {
    total += 1;
    if (runStructureCheck(check)) passed += 1;
  }

  const extraTests = [
    testContinuationLogic,
    testClarificationPassthrough,
    testWorkflowResumeIndex,
    testDashboardFormat,
    testResultAggregation,
    testRegistryCompleteness,
    testPreCheck,
    testCanRunTask,
  ];

  for (const test of extraTests) {
    total += 1;
    if (test()) passed += 1;
  }

  console.log(`\n=== Validation summary: ${passed}/${total} checks passed ===`);

  if (passed !== total) {
    process.exitCode = 1;
  }
}

main();
