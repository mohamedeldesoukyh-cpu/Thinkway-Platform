#!/usr/bin/env npx tsx
/**
 * ERS-3: Campaign Object Integrity — render path must use structured CampaignObject only.
 * Run: npx tsx features/campaign-intelligence/validate-ers3-campaign-object-integrity.ts
 */
import "@/lib/performance/script-env-preload";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
  STUDIO_SECTION_OWNERS,
  type StudioSectionId,
} from "./types/section-schemas";
import type { CampaignObject, CampaignSectionKey } from "./types/campaign-object";
import type { WorkflowTaskResult } from "@/features/ai-workflows/types";

import {
  resolveBudgetData,
  resolveCampaignSummary,
  resolveContentPlan,
  resolveCreativeConcepts,
  resolveCreatorMix,
  resolveExecutiveSummaryData,
  resolveGroundedKpis,
  resolveGroundedStrategyFields,
  resolveIndustryBenchmark,
  resolveOpportunities,
  resolvePresentationData,
  resolveRiskData,
  resolveSuccessProbability,
  resolveTimelineData,
  resolveVendorDiscovery,
  resolveWhyAi,
} from "@/features/campaign-studio/services/section-data-resolver";

const ARTIFACT_DIR = join(process.cwd(), "docs/validation-artifacts/ers-3");

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

function mockTask(
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

const SCENARIOS = [
  {
    id: "babyjoy",
    label: "BabyJoy",
    brandName: "BabyJoy",
    analyze:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
    strategy:
      "## Campaign Strategy\nAuthentic mom UGC for BabyJoy premium diapers.\n- Reach: 3M impressions\n- Engagement rate: 5.5%",
    budget:
      "Total budget: EGP 2,000,000\nCreator fees: EGP 1,240,000\nProduction: EGP 360,000\nContingency: 10%",
    timeline: "Week 1: Brief approval\nWeek 2: Vendor outreach\nWeek 3-4: Content production\nWeek 5: Go-live",
  },
  {
    id: "adidas",
    label: "Adidas",
    brandName: "Adidas Egypt",
    analyze:
      "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo and Alexandria. Budget EGP 4,500,000. Duration 6 weeks.",
    strategy:
      "## Campaign Strategy\nStreet-to-stadium launch for Adidas running collection.\n- Reach: 8M views\n- Conversion: 2.1%",
    budget:
      "Total budget: EGP 4,500,000\nCreator fees: EGP 2,790,000\nProduction: EGP 810,000\nContingency: 10%",
    timeline: "Week 1: Kickoff\nWeek 2: Creator outreach\nWeek 3-4: Production\nWeek 5: Launch",
  },
  {
    id: "rolex",
    label: "Rolex",
    brandName: "Rolex",
    analyze:
      "Rolex Middle East prestige campaign targeting affluent professionals in UAE and Saudi Arabia. Budget USD 850,000. Duration 8 weeks.",
    strategy:
      "## Campaign Strategy\nHeritage craftsmanship storytelling for Rolex.\n- Reach: 2.5M qualified impressions\n- Brand favorability: +12%",
    budget:
      "Total budget: USD 850,000\nCreator fees: USD 408,000\nProduction: USD 238,000\nContingency: 8%",
    timeline: "Week 1: Brief lock\nWeek 2: Creator curation\nWeek 3-6: Production\nWeek 7: Go-live",
  },
  {
    id: "tourism",
    label: "Tourism",
    brandName: "Visit Egypt",
    analyze:
      "Visit Egypt tourism campaign promoting ancient wonders and Red Sea adventures. Target adventure travelers 25–40. Budget USD 1,200,000. Duration 8 weeks.",
    strategy:
      "## Campaign Strategy\nDestination inspiration across TikTok, Instagram, YouTube.\n- Reach: 10M views\n- Trip planning clicks: 45K",
    budget:
      "Total budget: USD 1,200,000\nCreator fees: USD 504,000\nProduction: USD 264,000\nContingency: 10%",
    timeline: "Week 1: Strategy approval\nWeek 2: Discovery\nWeek 3-6: Content\nWeek 7: Launch",
  },
  {
    id: "finance",
    label: "Finance",
    brandName: "Emirates NBD",
    analyze:
      "Emirates NBD credit card launch in UAE. Target young professionals interested in finance, banking, and wealth management. Budget AED 600,000. Duration 6 weeks.",
    strategy:
      "## Campaign Strategy\nTrust-building finance education campaign.\n- Qualified leads: 2,500\n- Application rate: 1.8%",
    budget:
      "Total budget: AED 600,000\nCreator fees: AED 180,000\nProduction: AED 90,000\nContingency: 12%",
    timeline: "Week 1: Compliance review\nWeek 2: Educator outreach\nWeek 3-4: Content\nWeek 5: Go-live",
  },
] as const;

function buildScenarioObject(scenario: (typeof SCENARIOS)[number]): CampaignObject {
  const mockCreators = [
    { id: `cr_${scenario.id}_1`, handle: "creator_a", displayName: "Creator A", platform: "instagram", followers: 120000 },
    { id: `cr_${scenario.id}_2`, handle: "creator_b", displayName: "Creator B", platform: "tiktok", followers: 85000 },
  ];

  const director = new CampaignDirector(
    createEmptyCampaignObject({
      id: `camp_${scenario.id}`,
      conversationId: `conv_${scenario.id}`,
      workflowId: "create-campaign",
    })
  );

  const stateData = {
    brandName: scenario.brandName,
    currency: scenario.budget.match(/\b(EGP|AED|USD|SAR)\b/i)?.[1] ?? "USD",
    budgetTotal: parseInt(scenario.budget.replace(/[^\d]/g, "").slice(0, 7), 10) || undefined,
    searchResults: mockCreators,
    searchTotal: 12,
  };

  director.applyTaskResult(mockTask("analyze-request", scenario.analyze, "planner"), stateData);
  director.applyTaskResult(mockTask("build-strategy", scenario.strategy, "strategist"), stateData);
  director.applyTaskResult(mockTask("estimate-budget", scenario.budget, "analyst"), stateData);
  director.applyTaskResult(
    mockTask("search-creators", "12 creators found", "scout", {
      mode: "creator_search",
      creators: mockCreators,
      total: 12,
    }),
    stateData
  );
  director.applyTaskResult(
    mockTask("build-shortlist", "Top 2 ranked", "scout", { mode: "ranked_creators", creators: mockCreators }),
    stateData
  );
  director.applyTaskResult(mockTask("generate-timeline", scenario.timeline, "planner"), stateData);
  director.applyTaskResult(
    mockTask("prepare-approval", `${scenario.brandName} campaign draft`, "strategist"),
    stateData
  );

  return director.getObject();
}

type ScenarioReport = {
  id: string;
  label: string;
  passed: boolean;
  structuredSections: string[];
  studioSectionsPopulated: string[];
  violations: string[];
};

function validateScenarioObject(object: CampaignObject, label: string): ScenarioReport {
  const violations: string[] = [];
  const structuredSections: string[] = [];
  const studioSectionsPopulated: string[] = [];

  const summaryCards = object.sections.summary.data?.summaryCards;
  if (isSummarySectionData(summaryCards) && summaryCards.brand) structuredSections.push("summary.data.summaryCards");

  if (isBudgetSectionData(object.sections.budget.content)) structuredSections.push("budget.content");
  if (isTimelineSectionData(object.sections.timeline.content)) structuredSections.push("timeline.content");
  if (isKpiForecastSectionData(object.sections.performance.content)) structuredSections.push("performance.content");
  if (isRiskAnalysisSectionData(object.sections.operations.content)) structuredSections.push("operations.content");
  if (isPresentationStatusSectionData(object.sections.presentation.content)) {
    structuredSections.push("presentation.content");
  }

  if (object.sections.strategy.data?.groundedFields) structuredSections.push("strategy.data");
  if (object.sections.performance.data?.groundedKpis) structuredSections.push("performance.data");
  if (object.sections.timeline.data?.contentPlan) structuredSections.push("timeline.data");
  if (object.sections.presentation.data?.executiveSummary) structuredSections.push("presentation.data");

  const resolverChecks: Array<{ id: StudioSectionId; populated: boolean }> = [
    { id: "campaign-summary", populated: !!resolveCampaignSummary(object)?.brand },
    { id: "executive-strategy", populated: resolveGroundedStrategyFields(object).length > 0 },
    { id: "creator-discovery", populated: resolveVendorDiscovery(object, false).pipeline.length > 0 },
    { id: "budget-planner", populated: !!resolveBudgetData(object)?.allocations.length },
    { id: "timeline", populated: (resolveTimelineData(object)?.weeks.length ?? 0) > 0 },
    { id: "kpi-forecast", populated: resolveGroundedKpis(object).length > 0 },
    { id: "risk-analysis", populated: !!resolveRiskData(object)?.risks.length },
    { id: "creative-concepts", populated: resolveCreativeConcepts(object).length > 0 },
    { id: "content-plan", populated: resolveContentPlan(object).length > 0 },
    { id: "creator-mix", populated: resolveCreatorMix(object).length > 0 },
    { id: "why-ai", populated: resolveWhyAi(object).length > 0 },
    { id: "industry-benchmark", populated: !!resolveIndustryBenchmark(object)?.comparisons.length },
    { id: "success-probability", populated: !!resolveSuccessProbability(object)?.score },
    { id: "opportunity-finder", populated: resolveOpportunities(object).length > 0 },
    { id: "executive-summary", populated: !!resolveExecutiveSummaryData(object)?.summary },
    { id: "presentation-status", populated: !!resolvePresentationData(object)?.message },
  ];

  for (const check of resolverChecks) {
    if (check.populated) studioSectionsPopulated.push(check.id);
    else violations.push(`Studio section "${check.id}" empty after workflow`);
  }

  for (const [studioId, owner] of Object.entries(STUDIO_SECTION_OWNERS)) {
    const ownerKey = owner as CampaignSectionKey;
    const section = object.sections[ownerKey];
    if (section.status === "complete" && !section.content && !section.data) {
      violations.push(`Owner section "${ownerKey}" for "${studioId}" has no content or data`);
    }
  }

  const placeholderPattern = /not specified|creator\s+n\b|tbd\s*—|placeholder/i;
  const serialized = JSON.stringify(object.sections);
  if (placeholderPattern.test(serialized)) {
    violations.push(`Placeholder pattern detected in CampaignObject for ${label}`);
  }

  return {
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    passed: violations.length === 0,
    structuredSections,
    studioSectionsPopulated,
    violations,
  };
}

function scanRenderPathIntegrity(): string[] {
  const violations: string[] = [];
  const resolverSource = readFileSync(
    join(process.cwd(), "features/campaign-studio/services/section-data-resolver.ts"),
    "utf8"
  );
  const rendererDir = join(process.cwd(), "features/campaign-studio/components/sections");
  const rendererFiles = [
    "campaign-summary-section.tsx",
    "executive-strategy-section.tsx",
    "kpi-forecast-section.tsx",
    "budget-planner-section.tsx",
    "timeline-section.tsx",
    "risk-analysis-section.tsx",
    "creative-concepts-section.tsx",
    "content-plan-section.tsx",
    "creator-mix-section.tsx",
    "why-ai-section.tsx",
    "industry-benchmark-section.tsx",
    "success-probability-section.tsx",
    "opportunity-finder-section.tsx",
    "executive-summary-section.tsx",
    "presentation-status-section.tsx",
    "vendor-discovery-section.tsx",
    "vendor-recommendations-section.tsx",
  ];

  if (/stripMarkdown/.test(resolverSource)) {
    violations.push("section-data-resolver.ts contains stripMarkdown");
  }
  if (/JSON\.parse/.test(resolverSource)) {
    violations.push("section-data-resolver.ts contains JSON.parse");
  }
  if (/gatherContextText|parseExecutiveStrategy|parseCampaignSummary|deriveCreativeConcepts|deriveContentPlan/.test(resolverSource)) {
    violations.push("section-data-resolver.ts contains cross-section derivation helpers");
  }

  for (const file of rendererFiles) {
    const source = readFileSync(join(rendererDir, file), "utf8");
    if (/stripMarkdown/.test(source)) {
      violations.push(`${file} contains stripMarkdown in render path`);
    }
    if (/JSON\.parse/.test(source)) {
      violations.push(`${file} contains JSON.parse in render path`);
    }
  }

  return violations;
}

console.log("\n========== ERS-3 CAMPAIGN OBJECT INTEGRITY ==========\n");

console.log("--- Render path static analysis ---");
const renderViolations = scanRenderPathIntegrity();
if (renderViolations.length === 0) {
  assert("Render path free of markdown/JSON/cross-section parsing", true);
} else {
  for (const violation of renderViolations) {
    assert(violation, false);
  }
}

console.log("\n--- Scenario validation (5 industries) ---");
const scenarioReports: ScenarioReport[] = [];

for (const scenario of SCENARIOS) {
  console.log(`\n  ${scenario.label}`);
  const object = buildScenarioObject(scenario);
  const report = validateScenarioObject(object, scenario.label);
  scenarioReports.push(report);

  assert(`${scenario.label}: structured summary cards`, isSummarySectionData(object.sections.summary.data?.summaryCards));
  assert(`${scenario.label}: structured budget`, isBudgetSectionData(object.sections.budget.content));
  assert(`${scenario.label}: structured KPIs`, isKpiForecastSectionData(object.sections.performance.content));
  assert(`${scenario.label}: strategy studio data`, isStrategySectionData(object.sections.strategy.data) && (object.sections.strategy.data.creativeConcepts?.length ?? 0) > 0);
  assert(`${scenario.label}: all studio sections populated`, report.passed, report.violations.join("; "));
}

mkdirSync(ARTIFACT_DIR, { recursive: true });

const dependencyGraph = `# ERS-3 Campaign Studio Dependency Graph

## Task → CampaignObject section → Studio section

\`\`\`mermaid
flowchart LR
  analyze["analyze-request"] --> summary["summary + summary.data.summaryCards"]
  analyze --> audience["audience"]
  buildStrategy["build-strategy"] --> strategy["strategy + strategy.data"]
  buildStrategy --> performance["performance.content + performance.data"]
  estimateBudget["estimate-budget"] --> budget["budget.content + budget.data"]
  estimateBudget --> operations["operations.content + operations.data"]
  searchCreators["search-creators"] --> creators["creators.data.discovery"]
  buildShortlist["build-shortlist"] --> creatorsRec["creators.data.recommendations"]
  generateTimeline["generate-timeline"] --> timeline["timeline.content + timeline.data"]
  prepareApproval["prepare-approval"] --> presentation["presentation.content + presentation.data"]

  summary --> studioSummary["campaign-summary"]
  strategy --> studioStrategy["executive-strategy"]
  strategy --> studioConcepts["creative-concepts"]
  strategy --> studioMix["creator-mix"]
  strategy --> studioOpp["opportunity-finder"]
  strategy --> studioWhy["why-ai"]
  creators --> studioDiscovery["creator-discovery"]
  creators --> studioRec["creator-recommendations"]
  budget --> studioBudget["budget-planner"]
  timeline --> studioTimeline["timeline"]
  timeline --> studioContent["content-plan"]
  performance --> studioKpi["kpi-forecast"]
  performance --> studioBench["industry-benchmark"]
  performance --> studioSuccess["success-probability"]
  operations --> studioRisk["risk-analysis"]
  presentation --> studioExec["executive-summary"]
  presentation --> studioPres["presentation-status"]
\`\`\`

## Ownership rules (ERS-3)

| Studio section | CampaignObject path | Data type |
| --- | --- | --- |
| campaign-summary | \`sections.summary.data.summaryCards\` | SummarySectionData |
| executive-strategy | \`sections.strategy.data.groundedFields\` | GroundedStrategyField[] |
| creator-discovery | \`sections.creators.data.discoveryPipeline\` | DiscoveryPipelineStage[] |
| creator-recommendations | \`sections.creators.data.recommendations\` | CreatorRecommendationSectionData |
| budget-planner | \`sections.budget.content\` + \`.data\` | BudgetSectionData + extras |
| timeline | \`sections.timeline.content\` + \`.data.weekDetails\` | TimelineSectionData |
| kpi-forecast | \`sections.performance.data.groundedKpis\` | GroundedKpi[] |
| risk-analysis | \`sections.operations.content\` + \`.data.enrichedRisks\` | RiskAnalysisSectionData |
| creative-concepts | \`sections.strategy.data.creativeConcepts\` | CreativeConcept[] |
| content-plan | \`sections.timeline.data.contentPlan\` | ContentPlanItem[] |
| creator-mix | \`sections.strategy.data.creatorMix\` | CreatorMixTier[] |
| why-ai | \`sections.strategy.data.whyAiInsights\` | WhyAiInsight[] |
| industry-benchmark | \`sections.performance.data.industryBenchmark\` | IndustryBenchmarkData |
| success-probability | \`sections.performance.data.successProbability\` | SuccessProbabilityData |
| opportunity-finder | \`sections.strategy.data.opportunities\` | OpportunityItem[] |
| executive-summary | \`sections.presentation.data.executiveSummary\` | ExecutiveSummaryData |
| presentation-status | \`sections.presentation.content\` | PresentationStatusSectionData |

## Removed render-path fallbacks

- \`parseCampaignSummary\` / \`parseExecutiveStrategy\` markdown field extraction
- \`parseKpiFromFormattedText\` strategy text → KPI cards
- \`gatherContextText\` cross-section brief assembly in resolver
- Industry intelligence fallbacks when structured section empty (budget, timeline, KPI, risk)
- \`parseVendorsFromDisplay\` text parsing for vendor recommendations
- \`stripMarkdown\` in all section renderers and resolver
- Presentation-intelligence \`derive*\` calls from \`section-data-resolver\` (moved to \`studio-section-data-builders\` at write time)

## Duplicate fields removed

- Campaign summary no longer re-parses audience/strategy/presentation text at render time
- KPI forecast no longer duplicates strategy bullet KPIs via text parsing
- Executive strategy no longer merges parsed markdown lists with derived fields
- Budget planner no longer re-derives allocations from industry profile at render time
`;

writeFileSync(join(ARTIFACT_DIR, "dependency-graph.md"), dependencyGraph);

const reportMd = `# ERS-3 Campaign Object Integrity Report

Generated: ${new Date().toISOString()}

## Summary

- Render path violations: ${renderViolations.length}
- Scenarios passed: ${scenarioReports.filter((r) => r.passed).length}/${scenarioReports.length}
- Validation script: ${failed === 0 ? "PASS" : "FAIL"}

## Render path checks

${renderViolations.length === 0 ? "- No stripMarkdown, JSON.parse, or cross-section .content reads in resolver/renderers" : renderViolations.map((v) => `- FAIL: ${v}`).join("\n")}

## Scenario results

| Scenario | Status | Studio sections | Structured paths |
| --- | --- | ---: | --- |
${scenarioReports
  .map(
    (r) =>
      `| ${r.label} | ${r.passed ? "PASS" : "FAIL"} | ${r.studioSectionsPopulated.length}/16 | ${r.structuredSections.length} |`
  )
  .join("\n")}

${scenarioReports
  .filter((r) => !r.passed)
  .map((r) => `### ${r.label} violations\n\n${r.violations.map((v) => `- ${v}`).join("\n")}`)
  .join("\n\n")}

## Files changed (ERS-3)

- \`features/campaign-intelligence/types/section-schemas.ts\` — extended structured schemas + STUDIO_SECTION_OWNERS
- \`features/campaign-intelligence/services/studio-section-data-builders.ts\` — write-time structured data assembly
- \`features/campaign-intelligence/services/section-updaters.ts\` — enrich after task/summary sync
- \`features/campaign-studio/services/section-data-resolver.ts\` — structured-only render path
- \`features/campaign-studio/components/sections/*.tsx\` — removed markdown parsing fallbacks
- \`features/campaign-intelligence/services/studio-renderer.ts\` — pass campaignObject in studio state
`;

writeFileSync(join(ARTIFACT_DIR, "validation-report.md"), reportMd);
writeFileSync(
  join(ARTIFACT_DIR, "validation-report.json"),
  JSON.stringify({ renderViolations, scenarioReports, passed, failed }, null, 2)
);

console.log(`\n========== RESULTS: ${passed} passed, ${failed} failed ==========\n`);
console.log(`Artifacts: docs/validation-artifacts/ers-3/`);

if (failed > 0) {
  process.exit(1);
}
