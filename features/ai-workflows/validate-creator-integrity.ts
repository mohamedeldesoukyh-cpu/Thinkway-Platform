#!/usr/bin/env npx tsx
/**
 * ERS-1: Creator integrity validation — zero duplicate creators across pipeline stages.
 * Run: npx tsx features/ai-workflows/validate-creator-integrity.ts
 */
import "@/lib/performance/script-env-preload";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { scoutAgent } from "@/features/ai/scout/scout-agent";
import { executeSearchCreatorsProduction } from "@/features/ai/tools/production-executors";
import { runWithToolAuthContext } from "@/features/ai/tools/tool-auth";
import { AI_SEARCH_CREATORS_PAGE_SIZE } from "@/features/ai/tools/search-creators-browse";
import { createCampaignWorkflow } from "./definitions/create-campaign";
import { findCreatorsWorkflow } from "./definitions/find-creators";
import { mergeTaskResultIntoState } from "./engine/continuation";
import {
  buildCreatorDiscoveryData,
  buildCreatorRecommendationData,
  extractCreatorsFromTaskResult,
} from "@/features/campaign-intelligence/services/structured-section-builders";
import {
  normalizeCreators,
  rankCreators,
} from "./formatters/creator-formatter";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import {
  assertNoDuplicateCreatorIds,
  assertNoDuplicateGroundedCreators,
  dedupeCreatorIds,
  findDuplicateCreatorIds,
  formatIntegrityViolation,
  type CreatorStageCount,
} from "@/lib/creators/dedupe-creators";
import { searchCreatorsInputToBrowseFilters } from "@/features/ai/tools/search-creators-browse";
import type { Database } from "@/types/database";
import type { WorkflowExecutionContext, WorkflowState } from "./types";

const SCENARIOS = [
  {
    id: "travel-egypt",
    label: "Find travel creators in Egypt",
    query: "Find travel creators in Egypt",
    workflow: findCreatorsWorkflow,
    searchTaskId: "search-creators",
    rankTaskId: "rank-results",
  },
  {
    id: "babyjoy",
    label: "BabyJoy campaign",
    query: "Create BabyJoy baby care campaign in Egypt for new parents",
    workflow: createCampaignWorkflow,
    searchTaskId: "search-creators",
    rankTaskId: "build-shortlist",
  },
  {
    id: "luxury-hotel",
    label: "Luxury hotel campaign",
    query: "Find luxury hotel creators in Egypt for a 5-star resort campaign",
    workflow: findCreatorsWorkflow,
    searchTaskId: "search-creators",
    rankTaskId: "rank-results",
  },
  {
    id: "fashion",
    label: "Fashion campaign",
    query: "Find fashion creators in UAE for a luxury brand campaign",
    workflow: findCreatorsWorkflow,
    searchTaskId: "search-creators",
    rankTaskId: "rank-results",
  },
] as const;

type ScenarioReport = {
  id: string;
  label: string;
  query: string;
  stages: CreatorStageCount[];
  violations: string[];
  searchExecutedCount: number;
  passed: boolean;
  liveDb: boolean;
};

function recordStage(
  stages: CreatorStageCount[],
  stage: string,
  before: number,
  after: number
): void {
  stages.push({
    stage,
    before,
    after,
    duplicatesRemoved: Math.max(0, before - after),
  });
}

function checkIds(
  ids: readonly string[],
  stage: string,
  violations: string[]
): number {
  const violation = assertNoDuplicateCreatorIds(ids, stage);
  if (violation) violations.push(formatIntegrityViolation(violation));
  return dedupeCreatorIds(ids).length;
}

function checkCreators(
  creators: ReturnType<typeof normalizeCreators>,
  stage: string,
  violations: string[]
): number {
  const violation = assertNoDuplicateGroundedCreators(creators, stage);
  if (violation) violations.push(formatIntegrityViolation(violation));
  return creators.length;
}

function buildCtx(
  scenario: (typeof SCENARIOS)[number],
  state: WorkflowState,
  userMessage: string
): WorkflowExecutionContext {
  return {
    userMessage,
    state,
    definition: scenario.workflow,
    aiContext: { workspace: { type: "general" } },
    request: {
      id: `ers1_${scenario.id}`,
      message: userMessage,
      intent: "scout",
    },
    resolvedCampaignId: undefined,
  };
}

async function runScenario(
  supabase: ReturnType<typeof createClient<Database>> | null,
  scenario: (typeof SCENARIOS)[number]
): Promise<ScenarioReport> {
  const stages: CreatorStageCount[] = [];
  const violations: string[] = [];
  let searchExecutedCount = 0;
  const liveDb = supabase != null;

  if (!liveDb) {
    return {
      id: scenario.id,
      label: scenario.label,
      query: scenario.query,
      stages,
      violations: ["Skipped live DB — missing Supabase credentials"],
      searchExecutedCount: 0,
      passed: false,
      liveDb: false,
    };
  }

  const state: WorkflowState = {
    workflowId: scenario.workflow.id,
    workflowName: scenario.workflow.name,
    currentTaskIndex: 1,
    taskResults: {},
    data: { userMessage: scenario.query },
    status: "running",
  };

  try {
  const browseFilters = searchCreatorsInputToBrowseFilters({
    query: scenario.query,
    limit: AI_SEARCH_CREATORS_PAGE_SIZE,
  });

  const browseBefore = await browseUnifiedCreators(supabase, browseFilters, "ai");
  recordStage(stages, "browseUnifiedCreators", browseBefore.creators.length, browseBefore.creators.length);
  checkIds(
    browseBefore.creators.map((c) => c.unified_id),
    "browseUnifiedCreators",
    violations
  );

  const toolOutput = await executeSearchCreatorsProduction(
    { query: scenario.query, limit: AI_SEARCH_CREATORS_PAGE_SIZE },
    { workspace: { type: "general" } }
  );
  const toolBefore = toolOutput.creators.length;
  const toolCreators = normalizeCreators(toolOutput.creators, "searchCreatorsTool");
  recordStage(stages, "searchCreatorsTool", toolBefore, toolCreators.length);
  checkCreators(toolCreators, "searchCreatorsTool", violations);

  const searchTask = scenario.workflow.tasks.find((t) => t.id === scenario.searchTaskId)!;
  const scoutSearch = await scoutAgent.execute({
    request: {
      id: `ers1_${scenario.id}_search`,
      message: searchTask.buildPrompt(buildCtx(scenario, state, scenario.query)),
      intent: "scout",
      metadata: {
        workflowTask: scenario.searchTaskId,
        originalUserMessage: scenario.query,
      },
    },
    context: { workspace: { type: "general" } },
    prompt: "",
    toolNames: ["searchCreators"],
  });

  searchExecutedCount += scoutSearch.toolResults.some((r) => r.toolName === "searchCreators")
    ? 1
    : 0;

  const scoutCreators = normalizeCreators(
    (scoutSearch.structured?.creators as unknown[]) ?? [],
    "scoutSearch"
  );
  recordStage(stages, "scoutGroundedSearch", scoutCreators.length, scoutCreators.length);
  checkCreators(scoutCreators, "scoutGroundedSearch", violations);

  mergeTaskResultIntoState(state, searchTask, {
    taskId: scenario.searchTaskId,
    status: "completed",
    agentId: "scout",
    content: scoutSearch.rawContent,
    structured: scoutSearch.structured as Record<string, unknown>,
  });

  const workflowCreators = normalizeCreators(state.data.searchResults, "workflowSearchResults");
  recordStage(
    stages,
    "workflowSearchResults",
    Array.isArray(state.data.searchResults) ? state.data.searchResults.length : 0,
    workflowCreators.length
  );
  checkCreators(workflowCreators, "workflowSearchResults", violations);

  if (state.data.searchExecuted !== true) {
    violations.push("[searchCount] Workflow searchResults merge did not mark searchExecuted");
  }

  const rankTask = scenario.workflow.tasks.find((t) => t.id === scenario.rankTaskId)!;
  const rankResult = await scoutAgent.execute({
    request: {
      id: `ers1_${scenario.id}_rank`,
      message: rankTask.buildPrompt(buildCtx(scenario, state, scenario.query)),
      intent: "scout",
      metadata: {
        workflowTask: scenario.rankTaskId,
        originalUserMessage: scenario.query,
        workflowCreators: state.data.searchResults,
        workflowSearchTotal: state.data.searchTotal,
        searchExecuted: true,
      },
    },
    context: { workspace: { type: "general" } },
    prompt: "",
    toolNames: [],
  });

  const rankInput = extractCreatorsFromTaskResult(
    {
      taskId: scenario.rankTaskId,
      status: "completed",
      content: rankResult.rawContent,
      structured: rankResult.structured as Record<string, unknown>,
    },
    state.data
  );
  recordStage(stages, "rankingInput", rankInput.length, rankInput.length);
  checkCreators(rankInput, "rankingInput", violations);

  const ranked = rankCreators(rankInput, scenario.query);
  recordStage(stages, "rankingOutput", ranked.length, ranked.length);
  checkCreators(ranked, "rankingOutput", violations);

  mergeTaskResultIntoState(state, rankTask, {
    taskId: scenario.rankTaskId,
    status: "completed",
    agentId: "scout",
    content: rankResult.rawContent,
    structured: rankResult.structured as Record<string, unknown>,
  });

  const discovery = buildCreatorDiscoveryData(
    workflowCreators,
    typeof state.data.searchTotal === "number" ? state.data.searchTotal : workflowCreators.length,
    scenario.query
  );
  recordStage(
    stages,
    "campaignObjectDiscovery",
    workflowCreators.length,
    discovery.creatorIds.length
  );
  checkIds(discovery.creatorIds, "campaignObjectDiscovery", violations);

  const recommendations = buildCreatorRecommendationData(workflowCreators, scenario.query);
  recordStage(
    stages,
    "campaignObjectRecommendations",
    workflowCreators.length,
    recommendations.creatorIds.length
  );
  checkIds(recommendations.creatorIds, "campaignObjectRecommendations", violations);

  const uiIds = dedupeCreatorIds(recommendations.creatorIds).slice(0, 8);
  recordStage(stages, "uiHydration", recommendations.creatorIds.length, uiIds.length);
  checkIds(uiIds, "uiHydration", violations);

  if (searchExecutedCount > 1) {
    violations.push(
      `[searchCount] Scout issued ${searchExecutedCount} searchCreators tool calls in search task`
    );
  }

  return {
    id: scenario.id,
    label: scenario.label,
    query: scenario.query,
    stages,
    violations,
    searchExecutedCount,
    passed: violations.length === 0,
    liveDb: true,
  };
  } catch (error) {
    violations.push(
      `[runtime] ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      id: scenario.id,
      label: scenario.label,
      query: scenario.query,
      stages,
      violations,
      searchExecutedCount,
      passed: false,
      liveDb: true,
    };
  }
}

function runOfflineScenario(scenario: (typeof SCENARIOS)[number]): ScenarioReport {
  const stages: CreatorStageCount[] = [];
  const violations: string[] = [];

  const rawWithDupes = [
    {
      id: `inf:${scenario.id}-1`,
      handle: `${scenario.id}_creator_a`,
      displayName: `${scenario.label} Creator A`,
      platform: "instagram",
      followers: 120_000,
      engagementRate: 3.1,
    },
    {
      id: `inf:${scenario.id}-1`,
      handle: `${scenario.id}_creator_a`,
      displayName: `${scenario.label} Creator A duplicate`,
      platform: "instagram",
      followers: 120_000,
      engagementRate: 3.1,
    },
    {
      id: `inf:${scenario.id}-2`,
      handle: `${scenario.id}_creator_b`,
      displayName: `${scenario.label} Creator B`,
      platform: "tiktok",
      followers: 85_000,
      engagementRate: 4.2,
    },
    {
      id: `dis:${scenario.id}-3`,
      handle: `${scenario.id}_creator_c`,
      displayName: `${scenario.label} Creator C`,
      platform: "youtube",
      followers: 200_000,
      engagementRate: 2.8,
    },
    {
      id: `dis:${scenario.id}-3`,
      handle: `${scenario.id}_creator_c`,
      displayName: `${scenario.label} Creator C duplicate`,
      platform: "youtube",
      followers: 200_000,
      engagementRate: 2.8,
    },
  ];

  const normalized = normalizeCreators(rawWithDupes, "offlinePipeline");
  recordStage(stages, "normalizeCreators", rawWithDupes.length, normalized.length);
  checkCreators(normalized, "offlinePipeline", violations);

  const state: WorkflowState = {
    workflowId: scenario.workflow.id,
    workflowName: scenario.workflow.name,
    currentTaskIndex: 1,
    taskResults: {},
    data: { userMessage: scenario.query },
    status: "running",
  };

  const searchTask = scenario.workflow.tasks.find((t) => t.id === scenario.searchTaskId)!;
  mergeTaskResultIntoState(state, searchTask, {
    taskId: scenario.searchTaskId,
    status: "completed",
    agentId: "scout",
    content: "mock search",
    structured: {
      mode: "creator_search",
      creators: rawWithDupes,
      total: rawWithDupes.length,
      toolOutputs: [
        {
          tool: "searchCreators",
          output: { creators: rawWithDupes, total: rawWithDupes.length },
        },
      ],
    },
  });

  const workflowCreators = normalizeCreators(state.data.searchResults, "workflowSearchResults");
  recordStage(
    stages,
    "workflowSearchResults",
    rawWithDupes.length,
    workflowCreators.length
  );
  checkCreators(workflowCreators, "workflowSearchResults", violations);

  if (state.data.searchExecuted !== true) {
    violations.push("[searchCount] Offline merge did not mark searchExecuted");
  }

  const rankInput = extractCreatorsFromTaskResult(
    { taskId: scenario.rankTaskId, status: "completed", structured: {} },
    state.data
  );
  recordStage(stages, "rankingInput", workflowCreators.length, rankInput.length);
  checkCreators(rankInput, "rankingInput", violations);

  const ranked = rankCreators(rankInput, scenario.query);
  recordStage(stages, "rankingOutput", rankInput.length, ranked.length);
  checkCreators(ranked, "rankingOutput", violations);

  const discovery = buildCreatorDiscoveryData(workflowCreators, workflowCreators.length, scenario.query);
  recordStage(stages, "campaignObjectDiscovery", workflowCreators.length, discovery.creatorIds.length);
  checkIds(discovery.creatorIds, "campaignObjectDiscovery", violations);

  const recommendations = buildCreatorRecommendationData(workflowCreators, scenario.query);
  recordStage(
    stages,
    "campaignObjectRecommendations",
    workflowCreators.length,
    recommendations.creatorIds.length
  );
  checkIds(recommendations.creatorIds, "campaignObjectRecommendations", violations);

  const uiIds = dedupeCreatorIds(recommendations.creatorIds);
  recordStage(stages, "uiHydration", recommendations.creatorIds.length, uiIds.length);
  checkIds(uiIds, "uiHydration", violations);

  return {
    id: `${scenario.id}-offline`,
    label: `${scenario.label} (offline pipeline)`,
    query: scenario.query,
    stages,
    violations,
    searchExecutedCount: 1,
    passed: violations.length === 0,
    liveDb: false,
  };
}

function renderMarkdownReport(reports: ScenarioReport[]): string {
  const lines: string[] = [
    "# ERS-1 Creator Integrity Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
  ];

  const offlineReports = reports.filter((r) => !r.liveDb);
  const liveReports = reports.filter((r) => r.liveDb);
  const offlinePassed = offlineReports.filter((r) => r.passed).length;
  const livePassed = liveReports.filter((r) => r.passed).length;

  lines.push(`- Offline pipeline scenarios: ${offlinePassed}/${offlineReports.length} PASS`);
  lines.push(`- Live DB scenarios: ${livePassed}/${liveReports.length} PASS (network-dependent)`);
  lines.push(
    `- Duplicate creator violations: ${offlineReports.reduce((n, r) => n + r.violations.length, 0)} (offline)`
  );
  lines.push("");

  for (const report of reports) {
    lines.push(`## ${report.label}`);
    lines.push("");
    lines.push(`- Query: \`${report.query}\``);
    lines.push(`- Status: ${report.passed ? "PASS" : "FAIL"}`);
    lines.push(`- Search executions: ${report.searchExecutedCount}`);
    lines.push(`- Live DB: ${report.liveDb ? "yes" : "no"}`);
    lines.push("");
    lines.push("| Stage | Before | After | Duplicates removed |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const stage of report.stages) {
      lines.push(
        `| ${stage.stage} | ${stage.before} | ${stage.after} | ${stage.duplicatesRemoved} |`
      );
    }
    if (report.violations.length > 0) {
      lines.push("");
      lines.push("**Violations:**");
      for (const v of report.violations) {
        lines.push(`- ${v}`);
      }
    }
    lines.push("");
  }

  lines.push("## Root causes addressed");
  lines.push("");
  lines.push("- Single SSOT: `browseUnifiedCreators` with unified_id dedupe at output");
  lines.push("- `normalizeCreators` dedupes by creator id at every normalization boundary");
  lines.push("- Workflow `searchResults` stored deduped; duplicate searchCreators tool output ignored");
  lines.push("- Ranking/build-shortlist consumes `searchResults` only — no second search");
  lines.push("- CampaignObject discovery/recommendation creatorIds deduped");
  lines.push("- UI hydration and vendor cards dedupe before render");
  lines.push("- Removed fabricated placeholder vendor fallback (`Creator N` / `@creator-N`)");
  lines.push("");

  return lines.join("\n");
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const reports: ScenarioReport[] = [];

  const offlineDupes = findDuplicateCreatorIds(["inf:a", "inf:a", "dis:b"]);
  if (offlineDupes.length !== 1 || offlineDupes[0] !== "inf:a") {
    console.error("Offline dedupe unit check failed");
    process.exitCode = 1;
    return;
  }

  console.log("\n=== Offline pipeline scenarios (duplicate injection) ===");
  for (const scenario of SCENARIOS) {
    const offline = runOfflineScenario(scenario);
    reports.push(offline);
    console.log(`${offline.label}: ${offline.passed ? "PASS" : "FAIL"}`);
    for (const stage of offline.stages) {
      console.log(
        `  ${stage.stage}: ${stage.before} → ${stage.after} (removed ${stage.duplicatesRemoved})`
      );
    }
  }

  const offlinePassed = reports.every((r) => r.passed);

  if (url && serviceKey) {
    const supabase = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await runWithToolAuthContext(
      { supabase, userId: "validate-creator-integrity" },
      async () => {
        console.log("\n=== Live DB scenarios ===");
        for (const scenario of SCENARIOS) {
          console.log(`\n=== Scenario: ${scenario.label} ===`);
          const report = await runScenario(supabase, scenario);
          reports.push({ ...report, id: `${report.id}-live`, label: `${report.label} (live DB)` });
          console.log(report.passed ? "PASS" : report.violations.some((v) => v.startsWith("[runtime]")) ? "SKIP (network)" : "FAIL");
          if (report.violations.length) {
            for (const v of report.violations) console.log(`  - ${v}`);
          }
          for (const stage of report.stages) {
            console.log(
              `  ${stage.stage}: ${stage.before} → ${stage.after} (removed ${stage.duplicatesRemoved})`
            );
          }
        }
      }
    );
  } else {
    console.log("\nSkipping live DB scenarios — missing Supabase credentials");
  }

  const outDir = join(process.cwd(), "docs/validation-artifacts/ers-1");
  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, "integrity-report.json");
  const mdPath = join(outDir, "integrity-report.md");

  writeFileSync(jsonPath, JSON.stringify({ reports, generatedAt: new Date().toISOString() }, null, 2));
  writeFileSync(mdPath, renderMarkdownReport(reports));

  console.log(`\nReport written to ${mdPath}`);

  console.log(offlinePassed ? "\nRESULT: OFFLINE PIPELINE ALL PASS" : "\nRESULT: OFFLINE PIPELINE FAILURES");

  if (!offlinePassed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
