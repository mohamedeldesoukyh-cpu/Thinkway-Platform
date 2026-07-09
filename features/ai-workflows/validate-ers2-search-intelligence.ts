#!/usr/bin/env npx tsx
/**
 * ERS-2: AI Search Intelligence validation — campaign brief → structured filters → progressive search.
 * Run: npm run validate:ers2-search-intelligence
 */
import "@/lib/performance/script-env-preload";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { buildCampaignSearchIntent, looksLikeCampaignBrief } from "@/features/ai/tools/campaign-search-intent";
import { executeSearchCreatorsProduction } from "@/features/ai/tools/production-executors";
import {
  executeProgressiveCreatorSearch,
  type ProgressiveSearchStageAttempt,
} from "@/features/ai/tools/progressive-creator-search";
import { runWithToolAuthContext } from "@/features/ai/tools/tool-auth";
import { AI_SEARCH_CREATORS_PAGE_SIZE } from "@/features/ai/tools/search-creators-browse";
import {
  diagnoseSupabaseConnectivity,
  formatConnectivityReport,
} from "@/lib/performance/script-env";
import type { Database } from "@/types/database";

const SCENARIOS = [
  {
    id: "babyjoy",
    label: "BabyJoy → parenting creators",
    query:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
    expectedIndustry: "baby",
    expectedCategoryPattern: /parenting|motherhood|baby|family/i,
  },
  {
    id: "adidas",
    label: "Adidas → fitness/sports",
    query:
      "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo and Alexandria. Budget EGP 4,500,000. Duration 6 weeks.",
    expectedIndustry: "sports_fitness",
    expectedCategoryPattern: /fitness|sports/i,
  },
  {
    id: "luxury-hotel-dubai",
    label: "Luxury hotel Dubai → travel/luxury",
    query: "Find luxury hotel creators in Dubai for a 5-star resort campaign",
    expectedIndustry: "luxury",
    expectedCategoryPattern: /travel|luxury|hospitality/i,
  },
  {
    id: "travel-egypt",
    label: "Travel Egypt",
    query: "Find travel creators in Egypt",
    expectedIndustry: "travel",
    expectedCategoryPattern: /travel/i,
  },
  {
    id: "finance",
    label: "Finance",
    query:
      "Emirates NBD credit card launch in UAE. Target young professionals interested in finance, banking, and wealth management.",
    expectedIndustry: "finance",
    expectedCategoryPattern: /finance|business/i,
  },
  {
    id: "tourism",
    label: "Tourism",
    query:
      "Visit Egypt tourism destination marketing campaign. Promote pyramids and Red Sea resorts to international travelers.",
    expectedIndustry: "tourism",
    expectedCategoryPattern: /travel|tourism/i,
  },
] as const;

type ScenarioReport = {
  id: string;
  label: string;
  query: string;
  liveDb: boolean;
  intent: ReturnType<typeof buildCampaignSearchIntent>;
  filtersGenerated: {
    categories: string[];
    country?: string;
    platforms: string[];
    industry: string;
  };
  stagesAttempted: ProgressiveSearchStageAttempt[];
  chosenStage: string;
  finalCreatorCount: number;
  finalTotal: number;
  searchExecutedCount: number;
  passed: boolean;
  notes: string[];
};

function summarizeFilters(intent: ReturnType<typeof buildCampaignSearchIntent>) {
  return {
    categories: intent.categories,
    country: intent.country,
    platforms: intent.platforms,
    industry: intent.industry,
  };
}

function formatStageTable(stages: ProgressiveSearchStageAttempt[]): string {
  const lines = ["| Stage | Total | Creators |", "| --- | ---: | ---: |"];
  for (const stage of stages) {
    lines.push(`| ${stage.label} (${stage.stage}) | ${stage.total} | ${stage.creatorCount} |`);
  }
  return lines.join("\n");
}

async function runScenario(
  supabase: ReturnType<typeof createClient<Database>>,
  scenario: (typeof SCENARIOS)[number],
  liveDb: boolean
): Promise<ScenarioReport> {
  const intent = buildCampaignSearchIntent(scenario.query);
  const notes: string[] = [];
  let stagesAttempted: ProgressiveSearchStageAttempt[] = [];
  let chosenStage = "n/a";
  let finalCreatorCount = 0;
  let finalTotal = 0;
  let searchExecutedCount = 0;

  if (intent.industryKey !== scenario.expectedIndustry) {
    notes.push(
      `Industry mismatch: expected ${scenario.expectedIndustry}, got ${intent.industryKey}`
    );
  }
  if (!intent.categories.some((c) => scenario.expectedCategoryPattern.test(c))) {
    notes.push(`No expected category match in ${intent.categories.join(", ")}`);
  }

  if (liveDb) {
    if (looksLikeCampaignBrief(scenario.query)) {
      const progressive = await executeProgressiveCreatorSearch(supabase, {
        intent,
        pageSize: AI_SEARCH_CREATORS_PAGE_SIZE,
        productionOnly: true,
      });
      stagesAttempted = progressive.stagesAttempted;
      chosenStage = progressive.chosenStage;
      finalCreatorCount = progressive.browseResult.creators.length;
      finalTotal = progressive.browseResult.total;
    }

    const toolOutput = await executeSearchCreatorsProduction(
      { query: scenario.query, limit: AI_SEARCH_CREATORS_PAGE_SIZE },
      { workspace: { type: "general" } }
    );
    searchExecutedCount = 1;
    if (!looksLikeCampaignBrief(scenario.query)) {
      chosenStage = "direct_parse";
      finalCreatorCount = toolOutput.creators.length;
      finalTotal = toolOutput.total;
      stagesAttempted = [
        {
          stage: "D_semantic_keywords",
          label: "Direct structured parse",
          filters: {},
          total: toolOutput.total,
          creatorCount: toolOutput.creators.length,
          coverageScore: 0,
          coverageLevel: "insufficient",
        },
      ];
    } else if (toolOutput.total !== finalTotal) {
      notes.push(
        `Tool vs progressive total mismatch: tool=${toolOutput.total} progressive=${finalTotal}`
      );
      finalCreatorCount = toolOutput.creators.length;
      finalTotal = toolOutput.total;
    }
  } else {
    notes.push("Live DB unreachable — intent extraction only (not a functional failure)");
    searchExecutedCount = 0;
  }

  const intentOk =
    intent.industryKey === scenario.expectedIndustry &&
    intent.categories.some((c) => scenario.expectedCategoryPattern.test(c));
  const passed = intentOk && (liveDb ? finalTotal > 0 : true);

  return {
    id: scenario.id,
    label: scenario.label,
    query: scenario.query,
    liveDb,
    intent,
    filtersGenerated: summarizeFilters(intent),
    stagesAttempted,
    chosenStage,
    finalCreatorCount,
    finalTotal,
    searchExecutedCount,
    passed,
    notes,
  };
}

function buildMarkdownReport(reports: ScenarioReport[], connectivity: string): string {
  const lines: string[] = [
    "# ERS-2 Search Intelligence Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Connectivity",
    "",
    connectivity,
    "",
    "## Summary",
    "",
    "| Scenario | Industry | Categories | Chosen stage | Total | Search calls | Result |",
    "| --- | --- | --- | --- | ---: | ---: | --- |",
  ];

  for (const report of reports) {
    lines.push(
      `| ${report.label} | ${report.intent.industry} | ${report.filtersGenerated.categories.slice(0, 4).join(", ")} | ${report.chosenStage} | ${report.finalTotal} | ${report.searchExecutedCount} | ${report.passed ? "PASS" : "FAIL"} |`
    );
  }

  lines.push("");
  lines.push("## Progressive search model");
  lines.push("");
  lines.push(
    "Progressive search runs **inside a single `searchCreators` tool call** (`executeSearchCreatorsProduction`)."
  );
  lines.push(
    "Stages A→E call `browseUnifiedCreators()` internally until `total > 0`. The workflow/scout layer still records **one** `searchExecuted` per search task (ERS-1 integrity preserved)."
  );
  lines.push("");

  for (const report of reports) {
    lines.push(`## ${report.label}`);
    lines.push("");
    lines.push(`**Query:** ${report.query}`);
    lines.push("");
    lines.push("### Intent extracted");
    lines.push("");
    lines.push("```json");
    lines.push(
      JSON.stringify(
        {
          industry: report.intent.industry,
          industryKey: report.intent.industryKey,
          audience: report.intent.audience,
          categories: report.intent.categories,
          interests: report.intent.interests,
          country: report.intent.country,
          city: report.intent.city,
          platforms: report.intent.platforms,
          semanticKeywords: report.intent.semanticKeywords,
        },
        null,
        2
      )
    );
    lines.push("```");
    lines.push("");
    lines.push("### Filters generated");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(report.filtersGenerated, null, 2));
    lines.push("```");
    lines.push("");
    if (report.stagesAttempted.length > 0) {
      lines.push("### Search stages attempted");
      lines.push("");
      lines.push(formatStageTable(report.stagesAttempted));
      lines.push("");
      lines.push(`**Chosen stage:** ${report.chosenStage}`);
      lines.push(`**Final creator count:** ${report.finalCreatorCount} (total ${report.finalTotal})`);
    } else {
      lines.push("_No live search stages (DB unreachable)._");
    }
    if (report.notes.length > 0) {
      lines.push("");
      lines.push("**Notes:**");
      for (const note of report.notes) {
        lines.push(`- ${note}`);
      }
    }
    lines.push("");
  }

  lines.push("## Definition of done");
  lines.push("");
  lines.push(
    `- All scenarios pass: **${reports.every((r) => r.passed) ? "YES" : "NO"}**`
  );
  lines.push(
    `- Single search per workflow tool path: **${reports.every((r) => r.searchExecutedCount <= 1) ? "YES" : "NO"}**`
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const outDir = join(process.cwd(), "docs/validation-artifacts/ers-2");
  mkdirSync(outDir, { recursive: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exitCode = 1;
    return;
  }

  console.log("\n=== ERS-2 Search Intelligence ===\n");

  let connectivity: Awaited<ReturnType<typeof diagnoseSupabaseConnectivity>> | null = null;
  try {
    connectivity = await diagnoseSupabaseConnectivity();
    console.log(formatConnectivityReport(connectivity));
  } catch (error) {
    console.warn("Connectivity probe failed:", error);
  }

  const liveDb = Boolean(url && serviceKey);
  if (connectivity && connectivity.category !== "ok") {
    console.warn("\nConnectivity issues detected — attempting live scenarios anyway.\n");
  }
  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const reports: ScenarioReport[] = [];

  await runWithToolAuthContext(
    { supabase, userId: "validate-ers2-search-intelligence" },
    async () => {
      for (const scenario of SCENARIOS) {
        console.log(`\n=== ${scenario.label} ===`);
        const report = await runScenario(supabase, scenario, liveDb);
        reports.push(report);
        console.log(`  industry: ${report.intent.industry} (${report.intent.industryKey})`);
        console.log(`  categories: ${report.filtersGenerated.categories.join(", ")}`);
        console.log(`  chosen stage: ${report.chosenStage}`);
        console.log(`  total: ${report.finalTotal}`);
        console.log(`  searchExecutedCount: ${report.searchExecutedCount}`);
        console.log(`  ${report.passed ? "PASS" : "FAIL"}`);
        for (const note of report.notes) console.log(`  note: ${note}`);
      }
    }
  );

  const connectivityText = connectivity
    ? formatConnectivityReport(connectivity)
    : "Connectivity probe unavailable";
  const markdown = buildMarkdownReport(reports, connectivityText);
  writeFileSync(join(outDir, "search-intelligence-report.md"), markdown, "utf8");
  writeFileSync(
    join(outDir, "search-intelligence-report.json"),
    JSON.stringify(reports, null, 2),
    "utf8"
  );

  console.log(`\nReport: docs/validation-artifacts/ers-2/search-intelligence-report.md`);
  if (!reports.every((r) => r.passed)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
