#!/usr/bin/env npx tsx
/**
 * Trace creator count propagation through the find-creators workflow.
 * Run: AI_WORKFLOW_TRACE=1 npx tsx features/ai-workflows/validate-workflow-creator-trace.ts
 */
import "@/lib/performance/script-env-preload";

import { createClient } from "@supabase/supabase-js";
import { createAiOrchestrator } from "@/features/ai";
import {
  extractCreatorSearchQuery,
  scoutAgent,
} from "@/features/ai/scout/scout-agent";
import { parseCreatorSearchQuery } from "@/features/ai/tools/creator-search-parser";
import { executeSearchCreatorsProduction } from "@/features/ai/tools/production-executors";
import {
  AI_SEARCH_CREATORS_PAGE_SIZE,
  searchCreatorsInputToBrowseFilters,
} from "@/features/ai/tools/search-creators-browse";
import { runWithToolAuthContext } from "@/features/ai/tools/tool-auth";
import { findCreatorsWorkflow } from "./definitions/find-creators";
import { mergeTaskResultIntoState } from "./engine/continuation";
import { executeWorkflow } from "./engine/workflow-engine";
import { buildFindCreatorsReportInput } from "./formatters/executive-report-generator";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { logObjectShape } from "@/lib/creators/search-trace";
import type { Database } from "@/types/database";
import type { WorkflowState } from "./types";

const USER_MESSAGE = "Find travel creators in Egypt";

function workflowSearchPrompt(): string {
  return "Execute searchCreators with filters derived from the user's original request. Use best available filters from the request.";
}

const SCOUT_USER_MESSAGE_CASES = [
  { message: "Find travel creators in Egypt", expectedSearch: "travel" },
  { message: "Find beauty creators", expectedSearch: "beauty" },
  { message: "Find TikTok travel creators", expectedSearch: "travel" },
  { message: "Find nano beauty creators", expectedSearch: "beauty" },
] as const;

function testScoutUsesOriginalUserMessage(): boolean {
  console.log("\n========== SCOUT ORIGINAL USER MESSAGE (offline) ==========");

  let pass = true;

  for (const { message, expectedSearch } of SCOUT_USER_MESSAGE_CASES) {
    const wrappedPrompt = workflowSearchPrompt();
    const input = {
      request: {
        id: `trace_scout_${expectedSearch}`,
        message: wrappedPrompt,
        intent: "scout" as const,
        metadata: {
          workflowTask: "search-creators",
          originalUserMessage: message,
        },
      },
      context: { workspace: { type: "general" as const } },
      prompt: "",
      toolNames: ["searchCreators"],
    };

    const query = extractCreatorSearchQuery(input);
    const parsed = parseCreatorSearchQuery(message);
    const ok = query === (parsed.search || message.slice(0, 200)) && parsed.search === expectedSearch;

    console.log(`  "${message}"`);
    console.log(`    wrapped prompt: ${wrappedPrompt.slice(0, 60)}...`);
    console.log(`    extractCreatorSearchQuery: "${query}" ${ok ? "PASS" : `FAIL (expected "${expectedSearch}")`}`);
    if (!ok) pass = false;
  }

  const withoutMetadata = extractCreatorSearchQuery({
    request: {
      id: "trace_no_metadata",
      message: workflowSearchPrompt(),
      intent: "scout",
      metadata: { workflowTask: "search-creators" },
    },
    context: { workspace: { type: "general" } },
    prompt: "",
    toolNames: ["searchCreators"],
  });
  const wrappedOnlyOk = withoutMetadata !== "travel";
  console.log(
    `  Without originalUserMessage metadata falls back to prompt: ${wrappedOnlyOk ? "PASS (not travel)" : "FAIL"}`
  );
  if (!wrappedOnlyOk) pass = false;

  console.log(pass ? "\nRESULT: PASS\n" : "\nRESULT: FAIL\n");
  return pass;
}

function traceParserOffline(): void {
  console.log("\n========== PARSER OFFLINE (workflow prompt vs user message) ==========");
  const prompt = workflowSearchPrompt();
  const direct = parseCreatorSearchQuery(USER_MESSAGE);
  const fromPrompt = parseCreatorSearchQuery(prompt);
  console.log("User message parsed:", JSON.stringify(direct));
  console.log("Workflow prompt parsed:", JSON.stringify(fromPrompt));
  console.log("Workflow prompt raw:", prompt);
}

function summarizeStage(label: string, obj: unknown): void {
  const shape = logObjectShape(obj, label);
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(shape, null, 2));
}

async function traceDirectPath(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<void> {
  console.log("\n========== DIRECT PATH (user message) ==========");

  const browseFilters = searchCreatorsInputToBrowseFilters({
    query: USER_MESSAGE,
    limit: AI_SEARCH_CREATORS_PAGE_SIZE,
  });
  const browse = await browseUnifiedCreators(supabase, browseFilters, "ai");
  summarizeStage("1_browseUnifiedCreators", browse);

  const tool = await executeSearchCreatorsProduction(
    { query: USER_MESSAGE, limit: AI_SEARCH_CREATORS_PAGE_SIZE },
    { workspace: { type: "general" } }
  );
  summarizeStage("2_executeSearchCreatorsProduction", tool);
}

async function traceWorkflowPromptPath(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<void> {
  console.log("\n========== WORKFLOW PROMPT PATH (task buildPrompt) ==========");

  const prompt = workflowSearchPrompt();
  console.log(`Workflow message: ${prompt.slice(0, 120)}...`);
  console.log(`Parsed from prompt: ${JSON.stringify(parseCreatorSearchQuery(prompt))}`);

  const browseFilters = searchCreatorsInputToBrowseFilters({
    query: prompt,
    limit: AI_SEARCH_CREATORS_PAGE_SIZE,
  });
  const browse = await browseUnifiedCreators(supabase, browseFilters, "ai");
  summarizeStage("1_browseUnifiedCreators (workflow prompt)", browse);

  const tool = await executeSearchCreatorsProduction(
    { query: prompt, limit: AI_SEARCH_CREATORS_PAGE_SIZE },
    { workspace: { type: "general" } }
  );
  summarizeStage("2_executeSearchCreatorsProduction (workflow prompt)", tool);

  const scoutResult = await scoutAgent.execute({
    request: {
      id: "trace_scout_search",
      message: prompt,
      intent: "scout",
      metadata: { workflowTask: "search-creators", originalUserMessage: USER_MESSAGE },
    },
    context: { workspace: { type: "general" } },
    prompt: "",
    toolNames: ["searchCreators"],
  });
  summarizeStage("4_scout_executeGroundedSearch_return", scoutResult);

  const searchTask = findCreatorsWorkflow.tasks.find((t) => t.id === "search-creators")!;
  const state: WorkflowState = {
    workflowId: "find-creators",
    workflowName: "Find Creators",
    currentTaskIndex: 1,
    taskResults: {},
    data: { userMessage: USER_MESSAGE },
    status: "running",
  };

  mergeTaskResultIntoState(state, searchTask, {
    taskId: "search-creators",
    status: "completed",
    agentId: "scout",
    content: scoutResult.rawContent,
    structured: scoutResult.structured as Record<string, unknown>,
  });
  summarizeStage("7_workflowEngine_state (after search merge)", { data: state.data });

  const rankResult = await scoutAgent.execute({
    request: {
      id: "trace_scout_rank",
      message: prompt,
      intent: "scout",
      metadata: {
        workflowTask: "rank-results",
        originalUserMessage: USER_MESSAGE,
        workflowCreators: state.data.searchResults,
        workflowSearchTotal: state.data.searchTotal,
      },
    },
    context: { workspace: { type: "general" } },
    prompt: "",
    toolNames: [],
  });
  summarizeStage("8_rank_result", rankResult);

  const reportInput = buildFindCreatorsReportInput(state, USER_MESSAGE);
  summarizeStage("9_executiveReport_input", reportInput);
}

async function traceFullWorkflow(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<void> {
  console.log("\n========== FULL WORKFLOW (executeWorkflow) ==========");

  const orchestrator = createAiOrchestrator();
  const result = await executeWorkflow(
    findCreatorsWorkflow,
    {
      id: "trace_wf",
      message: USER_MESSAGE,
      intent: "scout",
    },
    { workspace: { type: "general" } },
    { orchestrator, supabase, startTaskIndex: 0 }
  );

  summarizeStage("7_workflowEngine_final_state", { data: result.state.data });
  const reportInput = buildFindCreatorsReportInput(result.state, USER_MESSAGE);
  summarizeStage("9_executiveReport_input (full wf)", reportInput);

  const searchTask = result.state.taskResults["search-creators"];
  if (searchTask?.structured) {
    summarizeStage("5_taskRunner_structured (search-creators)", searchTask.structured);
  }
}

function traceObjectMappingOffline(): void {
  console.log("\n========== OBJECT MAPPING OFFLINE (mock >0 creators) ==========");

  const mockToolOutput = {
    creators: [
      {
        id: "dis:abc",
        handle: "traveler",
        displayName: "Travel Creator",
        platform: "instagram",
        followers: 10000,
        engagementRate: 2.5,
      },
    ],
    total: 1,
  };

  const searchTask = findCreatorsWorkflow.tasks.find((t) => t.id === "search-creators")!;
  const state: WorkflowState = {
    workflowId: "find-creators",
    workflowName: "Find Creators",
    currentTaskIndex: 1,
    taskResults: {},
    data: {},
    status: "running",
  };

  const structured = {
    mode: "creator_search",
    creators: mockToolOutput.creators,
    total: mockToolOutput.total,
    toolOutputs: [{ tool: "searchCreators", output: mockToolOutput }],
  };

  summarizeStage("mock_tool_output", mockToolOutput);
  mergeTaskResultIntoState(state, searchTask, {
    taskId: "search-creators",
    status: "completed",
    agentId: "scout",
    content: "mock",
    structured,
  });
  summarizeStage("state_after_merge", { data: state.data });

  const rankCreatorsRaw = state.data.searchResults;
  const reportInput = buildFindCreatorsReportInput(state, USER_MESSAGE);
  summarizeStage("executive_report_after_merge", reportInput);

  const mappingOk =
    Array.isArray(rankCreatorsRaw) &&
    rankCreatorsRaw.length === 1 &&
    reportInput.creators.length === 1;
  console.log(`\nObject mapping chain preserves count: ${mappingOk ? "YES" : "NO"}`);
}

async function main(): Promise<void> {
  process.env.AI_WORKFLOW_TRACE = "1";

  const scoutMessageOk = testScoutUsesOriginalUserMessage();
  traceParserOffline();
  traceObjectMappingOffline();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("\nSkipping live DB trace — missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exitCode = scoutMessageOk ? 0 : 1;
    return;
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await runWithToolAuthContext(
    { supabase, userId: "validate-workflow-creator-trace" },
    async () => {
      await traceDirectPath(supabase);
      await traceWorkflowPromptPath(supabase);

      if (process.env.OPENAI_API_KEY) {
        await traceFullWorkflow(supabase);
      } else {
        console.log("\nSkipping full executeWorkflow — OPENAI_API_KEY not set (parse-criteria needs LLM).");
      }

      if (!scoutMessageOk) {
        process.exitCode = 1;
      }
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
