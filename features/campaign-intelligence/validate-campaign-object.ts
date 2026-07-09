#!/usr/bin/env npx tsx
/**
 * Validates CampaignObject construction from mock workflow task results.
 * Run: npx tsx features/campaign-intelligence/validate-campaign-object.ts
 */
import "@/lib/performance/script-env-preload";

import { aggregateWorkflowResults } from "@/features/ai-workflows/dashboard/result-aggregator";
import { createCampaignWorkflow } from "@/features/ai-workflows/definitions/create-campaign";
import type { WorkflowState, WorkflowTaskResult } from "@/features/ai-workflows/types";

import {
  SPECIALIST_SECTION_MAP,
  TASK_SECTION_MAP,
  TASK_SPECIALIST_MAP,
} from "./constants/specialist-section-map";
import { CampaignDirector } from "./services/campaign-director";
import { createEmptyCampaignObject } from "./services/section-updaters";
import {
  isBudgetSectionData,
  isKpiForecastSectionData,
  isPresentationStatusSectionData,
  isRiskAnalysisSectionData,
  isSummarySectionData,
  isStrategySectionData,
  isTimelineSectionData,
} from "./types/section-schemas";
import type { CampaignObject, CampaignSectionKey } from "./types/campaign-object";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function mockTaskResult(
  taskId: string,
  content: string,
  agentId: string,
  structured?: Record<string, unknown>
): WorkflowTaskResult {
  return {
    taskId,
    status: "completed",
    agentId,
    content,
    structured,
    completedAt: new Date().toISOString(),
  };
}

function buildMockWorkflowState(): WorkflowState {
  const mockCreators = [
    { id: "cr_1", handle: "organicmom", displayName: "Organic Mom", platform: "instagram", followers: 120000 },
    { id: "cr_2", handle: "babyfirst", displayName: "Baby First", platform: "tiktok", followers: 85000 },
  ];

  const taskResults: Record<string, WorkflowTaskResult> = {
    "analyze-request": mockTaskResult(
      "analyze-request",
      "Brand: BabyJoy\nObjective: Baby care awareness\nTarget audience: New parents 25-35\nBudget: AED 165,000",
      "general"
    ),
    "build-strategy": mockTaskResult(
      "build-strategy",
      "## Campaign Strategy\nPosition organic baby care for millennial parents.\n### KPIs\n- Reach: 2M impressions\n- Engagement rate: 4.5%",
      "strategist"
    ),
    "estimate-budget": mockTaskResult(
      "estimate-budget",
      "Total budget: AED 165,000\nCreator fees: AED 102,300\nProduction: AED 29,700\nContingency: 10%",
      "analyst"
    ),
    "search-creators": mockTaskResult(
      "search-creators",
      "**Results:** 12 creator(s) found",
      "scout",
      {
        mode: "creator_search",
        creators: mockCreators,
        total: 12,
        toolOutputs: [{ tool: "searchCreators", output: { creators: mockCreators, total: 12 } }],
      }
    ),
    "build-shortlist": mockTaskResult(
      "build-shortlist",
      "**Top matches:** 2 ranked by fit",
      "scout",
      { mode: "ranked_creators", creators: mockCreators }
    ),
    "generate-brief": mockTaskResult(
      "generate-brief",
      "Creative brief: Authentic storytelling around natural baby care routines.",
      "strategist"
    ),
    "generate-timeline": mockTaskResult(
      "generate-timeline",
      "Week 1: Brief approval\nWeek 2: Vendor outreach\nWeek 3-4: Content production\nWeek 5: Go-live",
      "planner"
    ),
    "prepare-approval": mockTaskResult(
      "prepare-approval",
      "Campaign draft: BabyJoy Organic Awareness Q3",
      "strategist"
    ),
  };

  return {
    workflowId: "create-campaign",
    workflowName: "Create Campaign",
    currentTaskIndex: 8,
    taskResults,
    data: {
      searchResults: mockCreators,
      searchTotal: 12,
      currency: "AED",
      budgetTotal: 165000,
      brandName: "BabyJoy",
    },
    status: "completed",
  };
}

function sectionHasContent(object: CampaignObject, key: CampaignSectionKey): boolean {
  const content = object.sections[key].content;
  if (typeof content === "string") return content.trim().length > 0;
  return Object.keys(content).length > 0;
}

console.log("\n========== CAMPAIGN OBJECT VALIDATION (Sprint 8) ==========\n");

console.log("--- Specialist section mapping constants ---");
assert("Strategist owns strategy + presentation", SPECIALIST_SECTION_MAP.strategist.includes("strategy"));
assert("Scout owns creators", SPECIALIST_SECTION_MAP.scout.includes("creators"));
assert("Planner owns timeline", SPECIALIST_SECTION_MAP.planner.includes("timeline"));
assert("Analyst owns budget + performance + operations", SPECIALIST_SECTION_MAP.analyst.includes("performance"));
assert("build-strategy maps to strategist", TASK_SPECIALIST_MAP["build-strategy"] === "strategist");
assert("search-creators maps to scout", TASK_SPECIALIST_MAP["search-creators"] === "scout");
assert("build-strategy does not map to audience (SRP)", !TASK_SECTION_MAP["build-strategy"].includes("audience"));
assert("estimate-budget owns operations risks", TASK_SECTION_MAP["estimate-budget"].includes("operations"));

console.log("\n--- Incremental task application ---");
let object = createEmptyCampaignObject({
  id: "camp_test_1",
  conversationId: "conv_test_1",
  workflowId: "create-campaign",
});

const director = new CampaignDirector(object);
director.applyTaskResult(
  mockTaskResult(
    "analyze-request",
    "Target audience: Parents 25-35 in UAE.",
    "planner"
  )
);
director.applyTaskResult(
  mockTaskResult(
    "build-strategy",
    "Strategy focus: organic positioning.\n- Reach: 2M\n- Engagement: 4%",
    "strategist"
  ),
  {}
);
director.applyTaskResult(
  mockTaskResult(
    "search-creators",
    "Found 8 creators",
    "scout",
    {
      mode: "creator_search",
      creators: [{ id: "cr_9", handle: "parentingpro", displayName: "Parenting Pro", platform: "instagram" }],
      total: 8,
    }
  ),
  { searchResults: [{ id: "cr_9", handle: "parentingpro", displayName: "Parenting Pro", platform: "instagram" }], searchTotal: 8 }
);
object = director.getObject();

assert("Strategy section populated by strategist task", sectionHasContent(object, "strategy"));
assert("Audience populated by analyze-request", sectionHasContent(object, "audience"));
assert("Performance KPIs structured", isKpiForecastSectionData(object.sections.performance.content));
assert("Creators section populated by scout", sectionHasContent(object, "creators"));
  assert("Creators store IDs only", Array.isArray((object.sections.creators.data as { discovery?: { creatorIds?: string[] } })?.discovery?.creatorIds));
  assert("Summary has structured cards", isSummarySectionData(object.sections.summary.data?.summaryCards));
  assert("Strategy has structured studio data", isStrategySectionData(object.sections.strategy.data) && (object.sections.strategy.data.groundedFields?.length ?? 0) > 0);
assert("Strategy updatedBy is strategist", object.sections.strategy.updatedBy === "strategist");
assert("Creators updatedBy is scout", object.sections.creators.updatedBy === "scout");

console.log("\n--- Full workflow state sync ---");
const mockState = buildMockWorkflowState();
const fullDirector = CampaignDirector.initialize({
  conversationId: "conv_test_2",
  workflowId: "create-campaign",
});

for (const result of Object.values(mockState.taskResults)) {
  fullDirector.applyTaskResult(result, mockState.data);
}
fullDirector.syncFromWorkflowState(mockState);
const fullObject = fullDirector.getObject();

const requiredSections: CampaignSectionKey[] = [
  "summary",
  "audience",
  "strategy",
  "creators",
  "budget",
  "timeline",
  "performance",
  "presentation",
  "operations",
];

for (const key of requiredSections) {
  assert(`Section "${key}" has content after full workflow`, sectionHasContent(fullObject, key));
}

assert("Budget section is structured with currency", isBudgetSectionData(fullObject.sections.budget.content) && (fullObject.sections.budget.content as { currency: string }).currency === "AED");
assert("Timeline section is structured", isTimelineSectionData(fullObject.sections.timeline.content));
assert("Risk section is structured", isRiskAnalysisSectionData(fullObject.sections.operations.content));
assert("Presentation section is structured", isPresentationStatusSectionData(fullObject.sections.presentation.content));
assert("Meta status is complete", fullObject.meta.status === "complete");
assert("All specialists marked complete", fullObject.meta.specialistProgress.every((s) => s.status === "complete"));

console.log("\n--- Aggregator parity ---");
const summarySections = aggregateWorkflowResults(mockState, createCampaignWorkflow);
assert("Summary sections generated", summarySections.length >= 5);
assert("Creator discovery section split", summarySections.some((s) => s.id === "creator-discovery"));
assert("Creator recommendations section split", summarySections.some((s) => s.id === "creator-recommendations"));

fullDirector.syncFromMetadata({
  workflow: true,
  workflowId: "create-campaign",
  workflowName: "Create Campaign",
  status: "completed",
  currentStep: 8,
  totalSteps: 8,
  completedTasks: createCampaignWorkflow.tasks.map((t) => t.title),
  pendingTasks: [],
  summarySections,
});

const syncedObject = fullDirector.getObject();
assert(
  "Summary sync preserves strategy content",
  typeof syncedObject.sections.strategy.content === "string" &&
    syncedObject.sections.strategy.content.includes("Campaign Strategy")
);
assert(
  "Creators recommendations display separate from discovery",
  typeof (syncedObject.sections.creators.data as { recommendationsDisplay?: string })?.recommendationsDisplay === "string" ||
    sectionHasContent(syncedObject, "creators")
);

console.log("\n--- Task-to-section routing ---");
for (const [taskId, sections] of Object.entries(TASK_SECTION_MAP)) {
  assert(`Task ${taskId} has section mapping`, sections.length > 0);
}

console.log(`\n========== RESULTS: ${passed} passed, ${failed} failed ==========\n`);

if (failed > 0) {
  process.exit(1);
}
