#!/usr/bin/env npx tsx
/**
 * Validates creator grounding — no hallucinated names, ranking from tool output.
 * Run: npx tsx features/ai-workflows/validate-creator-grounding.ts
 */
import "@/lib/performance/script-env-preload";

import { scoutAgent } from "@/features/ai/scout/scout-agent";
import {
  findUngroundedCreatorReferences,
  formatRankedResults,
  formatSearchResults,
  formatShortlistSuggestion,
  formatShortlistSuggestionMarkdown,
  normalizeCreators,
  rankCreators,
  stripConversationalFiller,
} from "./formatters/creator-formatter";
import { aggregateWorkflowResults } from "./dashboard/result-aggregator";
import { formatWorkflowDashboard } from "./dashboard/workflow-dashboard";
import { mergeTaskResultIntoState } from "./engine/continuation";
import { findCreatorsWorkflow } from "./definitions/find-creators";
import type { WorkflowState } from "./types";

const MOCK_CREATORS = normalizeCreators([
  {
    id: "creator_abc123",
    handle: "luxurytraveler",
    displayName: "Luxury Traveler",
    platform: "Instagram",
    followers: 245000,
    engagementRate: 3.2,
  },
  {
    id: "creator_def456",
    handle: "hotelsuite",
    displayName: "Hotel Suite Diaries",
    platform: "TikTok",
    followers: 89000,
    engagementRate: 4.8,
  },
  {
    id: "creator_ghi789",
    handle: "egyptexplorer",
    displayName: "Egypt Explorer",
    platform: "Instagram",
    followers: 156000,
    engagementRate: 2.9,
  },
]);

const FILLER_PHRASES = [
  "Feel free to ask",
  "Please provide",
  "Let me know",
];

function testFormatterGrounding(): boolean {
  console.log("\n=== Formatter grounding ===");

  const searchText = formatSearchResults(MOCK_CREATORS, MOCK_CREATORS.length, "luxury hotel Egypt");
  const ranked = rankCreators(MOCK_CREATORS, "luxury hotel Egypt");
  const rankText = formatRankedResults(ranked, "luxury hotel Egypt");
  const shortlist = formatShortlistSuggestion(ranked, "luxury hotel Egypt");
  const shortlistText = formatShortlistSuggestionMarkdown(shortlist);

  const hallucinations = [
    ...findUngroundedCreatorReferences(searchText, MOCK_CREATORS),
    ...findUngroundedCreatorReferences(rankText, MOCK_CREATORS),
    ...findUngroundedCreatorReferences(shortlistText, MOCK_CREATORS),
  ];

  const allIdsPresent = shortlist.creatorIds.every((id) =>
    MOCK_CREATORS.some((c) => c.id === id)
  );
  const rankUsesRealHandles = ranked.every((c) =>
    MOCK_CREATORS.some((m) => m.id === c.id)
  );
  const noFiller = [searchText, rankText, shortlistText].every(
    (text) => !FILLER_PHRASES.some((phrase) => text.includes(phrase))
  );

  console.log(`  Search output length: ${searchText.length}`);
  console.log(`  Ranked count: ${ranked.length}`);
  console.log(`  Shortlist IDs: ${shortlist.creatorIds.join(", ")}`);
  console.log(`  Hallucinations: ${hallucinations.length === 0 ? "none" : hallucinations.join(", ")}`);
  console.log(`  All shortlist IDs grounded: ${allIdsPresent}`);
  console.log(`  Ranking uses real creators: ${rankUsesRealHandles}`);
  console.log(`  No filler phrases: ${noFiller}`);

  const pass =
    hallucinations.length === 0 &&
    allIdsPresent &&
    rankUsesRealHandles &&
    noFiller &&
    searchText.includes("@luxurytraveler") &&
    shortlist.creatorIds.length > 0;

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

async function testScoutGroundedRank(): Promise<boolean> {
  console.log("\n=== Scout grounded rank (offline) ===");

  const input = {
    request: {
      id: "req_test",
      message: "Rank creators for luxury hotel Egypt",
      metadata: {
        workflowTask: "rank-results",
        workflowCreators: MOCK_CREATORS,
      },
    },
    context: { workspace: { type: "general" as const } },
    prompt: "",
    toolNames: [] as string[],
  };

  const result = await scoutAgent.execute(input);
  const hallucinations = findUngroundedCreatorReferences(result.rawContent, MOCK_CREATORS);
  const hasRealCreator = result.rawContent.includes("Luxury Traveler");
  const noFiller = !FILLER_PHRASES.some((p) => result.rawContent.includes(p));
  const structuredCreators = (result.structured?.creators as unknown[]) ?? [];

  console.log(`  Content includes real creator: ${hasRealCreator}`);
  console.log(`  Structured creators: ${structuredCreators.length}`);
  console.log(`  Hallucinations: ${hallucinations.length === 0 ? "none" : hallucinations.join(", ")}`);
  console.log(`  No filler: ${noFiller}`);

  const pass =
    hasRealCreator &&
    hallucinations.length === 0 &&
    noFiller &&
    structuredCreators.length === MOCK_CREATORS.length;

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

async function testScoutGroundedShortlist(): Promise<boolean> {
  console.log("\n=== Scout grounded shortlist (offline) ===");

  const input = {
    request: {
      id: "req_test",
      message: "Prepare shortlist for luxury hotel creators",
      metadata: {
        workflowTask: "shortlist-option",
        workflowCreators: MOCK_CREATORS,
      },
    },
    context: { workspace: { type: "general" as const } },
    prompt: "",
    toolNames: [] as string[],
  };

  const result = await scoutAgent.execute(input);
  const shortlist = result.structured?.shortlist as
    | ReturnType<typeof formatShortlistSuggestion>
    | undefined;
  const idsGrounded =
    shortlist?.creatorIds.every((id) => MOCK_CREATORS.some((c) => c.id === id)) ?? false;
  const noPlaceholders = !/placeholder|example creator|john smith|emma carter/i.test(
    result.rawContent
  );

  console.log(`  Shortlist name: ${shortlist?.name ?? "missing"}`);
  console.log(`  Creator IDs grounded: ${idsGrounded}`);
  console.log(`  No placeholders: ${noPlaceholders}`);

  const pass = idsGrounded && noPlaceholders && (shortlist?.creatorIds.length ?? 0) > 0;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testWorkflowAggregationDedup(): boolean {
  console.log("\n=== Workflow aggregation (executive report) ===");

  const searchContent = formatSearchResults(MOCK_CREATORS, MOCK_CREATORS.length, "luxury hotel");
  const rankContent = formatRankedResults(rankCreators(MOCK_CREATORS, "luxury hotel"));

  const state: WorkflowState = {
    workflowId: "find-creators",
    workflowName: "Find Creators",
    currentTaskIndex: 4,
    taskResults: {
      "parse-criteria": {
        taskId: "parse-criteria",
        status: "completed",
        content: "Niche: luxury hotel · Geography: Egypt",
      },
      "search-creators": {
        taskId: "search-creators",
        status: "completed",
        agentId: "scout",
        content: searchContent,
        structured: {
          mode: "creator_search",
          toolOutputs: [{ tool: "searchCreators", output: { creators: MOCK_CREATORS, total: 3 } }],
        },
      },
      "rank-results": {
        taskId: "rank-results",
        status: "completed",
        agentId: "scout",
        content: rankContent,
        structured: { mode: "ranked_creators", creators: rankCreators(MOCK_CREATORS) },
      },
      "shortlist-option": {
        taskId: "shortlist-option",
        status: "completed",
        agentId: "scout",
        content: stripConversationalFiller(
          formatShortlistSuggestionMarkdown(formatShortlistSuggestion(rankCreators(MOCK_CREATORS)))
        ),
      },
    },
    data: { searchResults: MOCK_CREATORS, searchTotal: 3, userMessage: "Find luxury hotel creators in Egypt" },
    status: "completed",
  };

  const sections = aggregateWorkflowResults(state, findCreatorsWorkflow);
  const dashboard = formatWorkflowDashboard({ state, actionCards: [] });

  const sectionTitles = sections.map((s) => s.title);
  const hasExecutiveSummary = sectionTitles.includes("Executive Summary");
  const hasTopRecommendations = sectionTitles.includes("Top Recommendations");
  const hasEightSections = sections.length === 8;
  const noLegacyDuplicateSections = !sectionTitles.includes("Creator Results");
  const dashboardConcise = !FILLER_PHRASES.some((p) => dashboard.content.includes(p));
  const hasFeaturedTable = sections.some(
    (s) => s.id === "top-recommendations" && s.content.includes("| Name |")
  );

  console.log(`  Sections: ${sectionTitles.join(", ")}`);
  console.log(`  8-section executive report: ${hasEightSections}`);
  console.log(`  Featured creator table: ${hasFeaturedTable}`);
  console.log(`  Dashboard concise: ${dashboardConcise}`);

  const pass =
    hasExecutiveSummary &&
    hasTopRecommendations &&
    hasEightSections &&
    noLegacyDuplicateSections &&
    dashboardConcise &&
    hasFeaturedTable;

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testTravelLuxuryScenario(): boolean {
  console.log("\n=== Travel/luxury/hotel scenario ===");

  const query = "luxury hotel creators in Egypt";
  const ranked = rankCreators(MOCK_CREATORS, query);
  const output = formatRankedResults(ranked, query);
  const ungrounded = findUngroundedCreatorReferences(output, MOCK_CREATORS);

  const usesAllFromTool = ranked.every((c) => MOCK_CREATORS.some((m) => m.id === c.id));
  const operationalFormat =
    output.includes("Top matches") && output.includes("fit");

  console.log(`  Query: ${query}`);
  console.log(`  Ungrounded refs: ${ungrounded.length}`);
  console.log(`  All from tool: ${usesAllFromTool}`);
  console.log(`  Operational format: ${operationalFormat}`);

  const pass = ungrounded.length === 0 && usesAllFromTool && operationalFormat;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testMergeCreatorSearchState(): boolean {
  console.log("\n=== Merge creator search into workflow state ===");

  const searchTask = findCreatorsWorkflow.tasks.find((t) => t.id === "search-creators")!;
  const state: WorkflowState = {
    workflowId: "find-creators",
    workflowName: "Find Creators",
    currentTaskIndex: 1,
    taskResults: {},
    data: {},
    status: "running",
  };

  // Regression: Sprint 6.8 scout sets structured.creators; toolOutputs may be empty.
  mergeTaskResultIntoState(state, searchTask, {
    taskId: "search-creators",
    status: "completed",
    agentId: "scout",
    content: formatSearchResults(MOCK_CREATORS, MOCK_CREATORS.length, "luxury hotel"),
    structured: {
      mode: "creator_search",
      creators: MOCK_CREATORS,
      total: MOCK_CREATORS.length,
      toolOutputs: [],
    },
  });

  const count = Array.isArray(state.data.searchResults)
    ? state.data.searchResults.length
    : 0;
  const totalOk = state.data.searchTotal === MOCK_CREATORS.length;

  console.log(`  searchResults count: ${count}`);
  console.log(`  searchTotal: ${state.data.searchTotal}`);
  console.log(`  total matches: ${totalOk}`);

  const pass = count === MOCK_CREATORS.length && totalOk;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

async function main(): Promise<void> {
  console.log("=== Sprint 6.7/6.8: Creator Grounding Validation ===");

  let passed = 0;
  let total = 0;

  const syncTests = [
    testFormatterGrounding,
    testMergeCreatorSearchState,
    testWorkflowAggregationDedup,
    testTravelLuxuryScenario,
  ];

  for (const test of syncTests) {
    total += 1;
    if (test()) passed += 1;
  }

  const asyncTests = [testScoutGroundedRank, testScoutGroundedShortlist];
  for (const test of asyncTests) {
    total += 1;
    if (await test()) passed += 1;
  }

  console.log(`\n=== Validation summary: ${passed}/${total} checks passed ===`);

  if (passed !== total) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
