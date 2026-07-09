#!/usr/bin/env npx tsx
/**
 * Validates executive report structure, deduplication, and content quality.
 * Run: npx tsx features/ai-workflows/validate-executive-report.ts
 */
import "@/lib/performance/script-env-preload";

import { aggregateWorkflowResults } from "./dashboard/result-aggregator";
import { formatWorkflowDashboard } from "./dashboard/workflow-dashboard";
import { findCreatorsWorkflow } from "./definitions/find-creators";
import {
  containsReportFiller,
  dedupeSentences,
  EXECUTIVE_REPORT_SECTIONS,
  generateFindCreatorsExecutiveReport,
  renderExecutiveReportMarkdown,
  validateExecutiveReportStructure,
} from "./formatters/executive-report-generator";
import { normalizeCreators, rankCreators } from "./formatters/creator-formatter";
import type { WorkflowState } from "./types";

const TRAVEL_MOCK_CREATORS = normalizeCreators([
  {
    id: "creator_travel_1",
    handle: "wanderlustdiaries",
    displayName: "Wanderlust Diaries",
    platform: "Instagram",
    followers: 320000,
    engagementRate: 3.8,
  },
  {
    id: "creator_travel_2",
    handle: "globetrotter_j",
    displayName: "Globetrotter Jess",
    platform: "TikTok",
    followers: 145000,
    engagementRate: 5.2,
  },
  {
    id: "creator_travel_3",
    handle: "adventurepath",
    displayName: "Adventure Path",
    platform: "Instagram",
    followers: 89000,
    engagementRate: 4.1,
  },
  {
    id: "creator_travel_4",
    handle: "budgetbackpack",
    displayName: "Budget Backpack",
    platform: "YouTube",
    followers: 520000,
    engagementRate: 2.4,
  },
  {
    id: "creator_travel_5",
    handle: "luxuryescapes",
    displayName: "Luxury Escapes",
    platform: "Instagram",
    followers: 210000,
    engagementRate: 3.5,
  },
]);

const FILLER_PHRASES = [
  "Feel free to ask",
  "Let me know",
  "Please provide",
  "I'm here to help",
  "Happy to help",
];

/** BEFORE: legacy-style repetitive output (simulated). */
const BEFORE_EXAMPLE = `
### Search Criteria
Niche: travel · Geography: global

### Creator Results
**Top matches:** 5 ranked by fit
1. Wanderlust Diaries (@wanderlustdiaries) · Instagram · 320.0K · 3.80% engagement · fit 72/100
2. Globetrotter Jess (@globetrotter_j) · TikTok · 145.0K · 5.20% engagement · fit 68/100
3. Adventure Path (@adventurepath) · Instagram · 89.0K · 4.10% engagement · fit 65/100
4. Budget Backpack (@budgetbackpack) · YouTube · 520.0K · 2.40% engagement · fit 61/100
5. Luxury Escapes (@luxuryescapes) · Instagram · 210.0K · 3.50% engagement · fit 58/100

### Shortlist Option
**Shortlist:** Find travel creators — Top 5 Creators
Top 5 creators by fit score from search results: @wanderlustdiaries, @globetrotter_j, @adventurepath, @budgetbackpack, @luxuryescapes.
**Creators:**
- Wanderlust Diaries (@wanderlustdiaries) · ID \`creator_travel_1\` · fit 72/100
- Globetrotter Jess (@globetrotter_j) · ID \`creator_travel_2\` · fit 68/100
`.trim();

function testEightSectionStructure(): boolean {
  console.log("\n=== 8-section structure ===");

  const report = generateFindCreatorsExecutiveReport({
    userMessage: "Find travel creators",
    searchCriteria: "Niche: travel · Platform: Instagram, TikTok, YouTube",
    creators: TRAVEL_MOCK_CREATORS,
    totalResults: 5,
    searchQuery: "Find travel creators",
  });

  const validation = validateExecutiveReportStructure(report);
  const idsMatch = EXECUTIVE_REPORT_SECTIONS.every((expected) =>
    report.some((s) => s.id === expected.id && s.title === expected.title)
  );

  console.log(`  Sections: ${report.length}`);
  console.log(`  All 8 present: ${validation.valid}`);
  console.log(`  Missing: ${validation.missing.join(", ") || "none"}`);
  console.log(`  IDs match canonical: ${idsMatch}`);

  const pass = validation.valid && idsMatch && report.length === 8;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testNoFillerPhrases(): boolean {
  console.log("\n=== No filler phrases ===");

  const report = generateFindCreatorsExecutiveReport({
    userMessage: "Find travel creators",
    creators: TRAVEL_MOCK_CREATORS,
    totalResults: 5,
  });
  const markdown = renderExecutiveReportMarkdown(report);
  const hasFiller =
    FILLER_PHRASES.some((p) => markdown.includes(p)) || containsReportFiller(markdown);

  console.log(`  Filler detected: ${hasFiller}`);
  const pass = !hasFiller;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testDedupeSentences(): boolean {
  console.log("\n=== Sentence deduplication ===");

  const duplicate =
    "Found 5 creators. Found 5 creators. Instagram leads the mix. Instagram leads the mix.";
  const deduped = dedupeSentences(duplicate);
  const uniqueCount = deduped.split(".").filter((s) => s.trim()).length;

  console.log(`  Input sentences: 4 (2 duplicates)`);
  console.log(`  Output unique: ${uniqueCount}`);
  const pass = uniqueCount === 2 && !deduped.includes("Found 5 creators. Found 5 creators");
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testFeaturedCreatorFields(): boolean {
  console.log("\n=== Featured creator table fields ===");

  const report = generateFindCreatorsExecutiveReport({
    userMessage: "Find travel creators",
    creators: TRAVEL_MOCK_CREATORS,
    totalResults: 5,
    searchQuery: "travel creators",
  });

  const recommendations = report.find((s) => s.id === "top-recommendations");
  const content = recommendations?.content ?? "";
  const requiredColumns = [
    "Name",
    "Platform",
    "Followers",
    "Engagement",
    "Why selected",
    "Audience fit",
    "Campaign fit",
    "Potential risks",
  ];
  const hasAllColumns = requiredColumns.every((col) => content.includes(col));
  const hasCreatorName = content.includes("Wanderlust Diaries");
  const hasAnalysis = content.includes("fit score") || content.includes("engagement");

  console.log(`  Table columns present: ${hasAllColumns}`);
  console.log(`  Creator names included: ${hasCreatorName}`);
  console.log(`  Analysis fields populated: ${hasAnalysis}`);

  const pass = hasAllColumns && hasCreatorName && hasAnalysis;
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testWorkflowIntegration(): boolean {
  console.log("\n=== Workflow aggregation integration ===");

  const state: WorkflowState = {
    workflowId: "find-creators",
    workflowName: "Find Creators",
    currentTaskIndex: 4,
    taskResults: {
      "parse-criteria": {
        taskId: "parse-criteria",
        status: "completed",
        content: "Niche: travel · Platform: Instagram, TikTok",
      },
      "search-creators": {
        taskId: "search-creators",
        status: "completed",
        agentId: "scout",
        structured: {
          mode: "creator_search",
          toolOutputs: [
            { tool: "searchCreators", output: { creators: TRAVEL_MOCK_CREATORS, total: 5 } },
          ],
        },
      },
      "rank-results": {
        taskId: "rank-results",
        status: "completed",
        agentId: "scout",
        structured: { mode: "ranked_creators", creators: rankCreators(TRAVEL_MOCK_CREATORS, "travel") },
      },
      "shortlist-option": {
        taskId: "shortlist-option",
        status: "completed",
        agentId: "scout",
        content: "Shortlist prepared.",
      },
    },
    data: {
      searchResults: TRAVEL_MOCK_CREATORS,
      searchTotal: 5,
      userMessage: "Find travel creators",
    },
    status: "completed",
  };

  const sections = aggregateWorkflowResults(state, findCreatorsWorkflow);
  const dashboard = formatWorkflowDashboard({ state, actionCards: [] });
  const validation = validateExecutiveReportStructure(
    sections.map((s) => ({ id: s.id as never, title: s.title, content: s.content }))
  );

  const noLegacySections = !sections.some((s) =>
    ["Creator Results", "Shortlist Option"].includes(s.title)
  );
  const hasExecutiveHeader = dashboard.content.includes("Executive Report");
  const noDuplicateNames =
    (dashboard.content.match(/Wanderlust Diaries/g) ?? []).length <= 3;

  console.log(`  Sections: ${sections.length}`);
  console.log(`  Executive structure valid: ${validation.valid}`);
  console.log(`  No legacy sections: ${noLegacySections}`);
  console.log(`  Dashboard uses Executive Report: ${hasExecutiveHeader}`);
  console.log(`  Name repetition limited: ${noDuplicateNames}`);

  const pass =
    validation.valid &&
    sections.length === 8 &&
    noLegacySections &&
    hasExecutiveHeader &&
    noDuplicateNames;

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function testBeforeAfterComparison(): boolean {
  console.log("\n=== Before/after comparison (Find travel creators) ===");

  const afterReport = generateFindCreatorsExecutiveReport({
    userMessage: "Find travel creators",
    searchCriteria: "Niche: travel · Platform: Instagram, TikTok, YouTube",
    creators: TRAVEL_MOCK_CREATORS,
    totalResults: 5,
    searchQuery: "Find travel creators",
  });
  const afterMarkdown = renderExecutiveReportMarkdown(afterReport);

  const beforeLines = BEFORE_EXAMPLE.split("\n").length;
  const afterLines = afterMarkdown.split("\n").length;
  const beforeNameMentions = (BEFORE_EXAMPLE.match(/Wanderlust Diaries/g) ?? []).length;
  const afterNameMentions = (afterMarkdown.match(/Wanderlust Diaries/g) ?? []).length;

  console.log(`  BEFORE (${beforeLines} lines, ${beforeNameMentions}x name repeats):`);
  console.log(`    ${BEFORE_EXAMPLE.slice(0, 120).replace(/\n/g, " ")}...`);
  console.log(`  AFTER (${afterLines} lines, ${afterNameMentions}x name repeats):`);
  console.log(`    Sections: ${afterReport.map((s) => s.title).join(" → ")}`);
  console.log(`    Executive summary: ${afterReport[0]?.content.slice(0, 100)}...`);

  const pass =
    afterReport.length === 8 &&
    afterNameMentions <= beforeNameMentions &&
    afterMarkdown.includes("Creator Analysis") &&
    !afterMarkdown.includes("Feel free to ask");

  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  return pass;
}

function main(): void {
  console.log("=== Executive Report Validation ===");

  const tests = [
    testEightSectionStructure,
    testNoFillerPhrases,
    testDedupeSentences,
    testFeaturedCreatorFields,
    testWorkflowIntegration,
    testBeforeAfterComparison,
  ];

  let passed = 0;
  for (const test of tests) {
    if (test()) passed += 1;
  }

  console.log(`\n=== Validation summary: ${passed}/${tests.length} checks passed ===`);

  if (passed !== tests.length) {
    process.exitCode = 1;
  }
}

main();
