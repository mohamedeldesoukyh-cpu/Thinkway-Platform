#!/usr/bin/env node
/**
 * Sprint BL-1 — Business Logic Refinement validation.
 * Run: npx tsx scripts/validate-bl1-business-logic.mjs
 *
 * NOTE: Automated checks only — manual QA still pending before release sign-off.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "release");

const FIXTURES = [
  {
    id: "babyjoy",
    label: "BabyJoy",
    brandName: "BabyJoy",
    rawMessage:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
  },
  {
    id: "cocacola",
    label: "Coca-Cola",
    brandName: "Coca-Cola",
    rawMessage:
      "Strategize a Coca-Cola summer engagement campaign targeting Gen Z. Budget $500,000 across Instagram and TikTok for 8 weeks.",
  },
  {
    id: "pepsi",
    label: "Pepsi",
    brandName: "Pepsi",
    rawMessage:
      "Plan a Pepsi summer Gen Z engagement campaign in MENA. Budget $400,000. Campaign duration 6 weeks. Objective: Engagement and participation.",
  },
  {
    id: "samsung",
    label: "Samsung",
    brandName: "Samsung",
    rawMessage:
      "Launch Samsung Galaxy S26 product awareness campaign in MENA. Budget USD 1,200,000. Campaign duration 6 weeks. Platforms Instagram, TikTok, YouTube.",
  },
  {
    id: "loreal",
    label: "L'Oréal",
    brandName: "L'Oréal",
    rawMessage:
      "Plan L'Oréal Paris skincare engagement campaign for women 25–40. Budget EUR 600,000. Campaign duration 5 weeks. Objective: Engagement and UGC.",
  },
  {
    id: "studio-split",
    label: "Studio Split Brief",
    brandName: "Luxury Hotel Dubai",
    rawMessage:
      "Luxury hotel launch in Dubai. Budget AED 1,200,000 for 10 weeks. Need dedicated studio photography and usage rights for paid boosting.",
  },
  {
    id: "c16",
    label: "C16 BabyJoy (no production / no usage rights)",
    brandName: "BabyJoy",
    rawMessage:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC. No production. No usage rights.",
  },
];

const BENCHMARK_METRICS = [
  "Market Landscape",
  "Creator Pricing",
  "Expected Engagement",
  "Seasonal Considerations",
  "Competitive Activity",
  "Success Factors",
  "Key Risks",
];

const OBJECTIVE_ASSESSMENT_FIELDS = [
  "objective",
  "confidence",
  "supportingEvidence",
  "risks",
  "recommendations",
];

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const { extractCampaignFacts, validateCampaignFacts } = await import(
    "../features/campaign-director/facts/index.ts"
  );
  const { runCampaignDirectorPipeline, buildDirectorBudgetFromStrategy, detectBudgetSplitKeywords } =
    await import("../features/campaign-director/index.ts");
  const { buildIs1ReasoningBundle } = await import(
    "../features/campaign-intelligence/services/reasoning/index.ts"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let passed = 0;
  let failed = 0;
  let babyJoySample = null;

  console.log("\n========== BL-1 BUSINESS LOGIC VALIDATION ==========\n");
  console.log("Status: automated checks only — manual QA PENDING\n");

  for (const fixture of FIXTURES) {
    console.log(`--- ${fixture.label} (${fixture.id}) ---`);
    const checks = [];

    function check(name, condition, detail = "") {
      const ok = Boolean(condition);
      checks.push({ name, ok, detail });
      if (ok) {
        passed++;
        console.log(`  ✓ ${name}`);
      } else {
        failed++;
        console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
      }
    }

    const campaignFacts = validateCampaignFacts(
      extractCampaignFacts({
        rawMessage: fixture.rawMessage,
        brandName: fixture.brandName,
      })
    );

    const pipeline = runCampaignDirectorPipeline({
      brief: { rawMessage: fixture.rawMessage, brandName: fixture.brandName, campaignFacts },
      campaignFacts,
    });

    const budget = buildDirectorBudgetFromStrategy(
      pipeline.strategyDocument,
      fixture.rawMessage,
      campaignFacts
    );

    const bundle = buildIs1ReasoningBundle(campaignFacts, pipeline.strategyDocument, {
      briefText: fixture.rawMessage,
      specialistOutputs: pipeline.specialistOutputs,
      debateResult: pipeline.debateResult,
    });

    const splitKeywords = detectBudgetSplitKeywords(fixture.rawMessage, campaignFacts);
    const isSplitFixture = fixture.id === "studio-split";
    const creatorFees = budget.allocations.find((a) => /creator\s*fees?/i.test(a.category));

    check(
      "Budget split keywords detected only when present",
      isSplitFixture ? splitKeywords.length > 0 : splitKeywords.length === 0,
      isSplitFixture
        ? `expected keywords, got: ${splitKeywords.map((k) => k.keyword).join(", ") || "none"}`
        : `unexpected: ${splitKeywords.map((k) => k.keyword).join(", ")}`
    );

    check(
      isSplitFixture ? "Budget splits on studio/usage keywords" : "Budget default 100% creator fees",
      isSplitFixture
        ? budget.allocations.some((a) => /production|studio|usage|boosting|agency|photograph/i.test(a.category))
        : (creatorFees?.percent ?? 0) === 100,
      `allocations: ${budget.allocations.map((a) => `${a.category} ${a.percent ?? 0}%`).join(", ")}`
    );

    check(
      "Budget allocation has rationale",
      budget.allocations.every((a) => a.notes?.trim() || bundle.budgetPlanner.allocations.some((r) => r.reason?.trim())),
      "missing notes/reason on allocation lines"
    );

    check(
      "Timeline weeks = durationWeeks",
      bundle.creatorActivationTimeline.activationWeeks.length === campaignFacts.durationWeeks,
      `got ${bundle.creatorActivationTimeline.activationWeeks.length}, expected ${campaignFacts.durationWeeks}`
    );

    check(
      "Timeline tier + objective per week",
      bundle.creatorActivationTimeline.activationWeeks.every(
        (w) => w.tier?.trim() && w.objective?.trim() && !/reporting/i.test(w.objective)
      ),
      "missing tier/objective or reporting embedded in campaign week"
    );

    check(
      "Reporting outside campaign duration",
      bundle.creatorActivationTimeline.reportingPhase.label.toLowerCase().includes("reporting") &&
        !bundle.creatorActivationTimeline.activationWeeks.some((w) =>
          /post-campaign reporting/i.test(w.objective)
        ),
      "reporting must be post-campaign phase, not inside activation weeks"
    );

    const benchmark = bundle.industryBenchmark;
    const comparisonMetrics = benchmark.comparisons.map((c) => c.metric);
    check(
      "Industry benchmark has competitive intelligence rows",
      BENCHMARK_METRICS.every((m) => comparisonMetrics.includes(m)),
      `missing: ${BENCHMARK_METRICS.filter((m) => !comparisonMetrics.includes(m)).join(", ")}`
    );

    check(
      "Industry benchmark not generic CPM/ER only",
      !comparisonMetrics.every((m) => /^(Expected ER|Est\. CPM)$/i.test(m)),
      `metrics: ${comparisonMetrics.join(", ")}`
    );

    check(
      "Industry benchmark competitiveIntelligence object",
      Boolean(benchmark.competitiveIntelligence?.marketLandscape) &&
        Array.isArray(benchmark.competitiveIntelligence?.successFactors) &&
        Array.isArray(benchmark.competitiveIntelligence?.keyRisks),
      "competitiveIntelligence structure incomplete"
    );

    const assessment = bundle.objectiveAchievement;
    check(
      "Success probability → objective achievement structure",
      Array.isArray(assessment.objectiveAssessments) &&
        assessment.objectiveAssessments.length > 0 &&
        assessment.objectiveAssessments.every((entry) =>
          OBJECTIVE_ASSESSMENT_FIELDS.every((field) => entry[field] != null)
        ),
      `fields checked: ${OBJECTIVE_ASSESSMENT_FIELDS.join(", ")}`
    );

    check(
      "Objective score equals average confidence",
      assessment.score ===
        Math.round(
          assessment.objectiveAssessments.reduce((sum, e) => sum + e.confidence, 0) /
            assessment.objectiveAssessments.length
        ),
      `score=${assessment.score}`
    );

    if (fixture.id === "babyjoy") {
      babyJoySample = {
        budget: {
          allocations: budget.allocations.map((a) => ({
            category: a.category,
            percent: a.percent,
            notes: a.notes,
          })),
          splitKeywords,
          reasoning: bundle.budgetPlanner.allocations[0],
        },
        timeline: {
          weeks: bundle.creatorActivationTimeline.activationWeeks.map((w) => ({
            week: w.week,
            tier: w.tier,
            objective: w.objective,
          })),
          reportingPhase: bundle.creatorActivationTimeline.reportingPhase,
        },
        industryBenchmark: {
          summary: benchmark.summary,
          comparisons: benchmark.comparisons.map((c) => ({
            metric: c.metric,
            expected: c.expected.slice(0, 120),
          })),
          competitiveIntelligence: benchmark.competitiveIntelligence,
        },
        objectiveAchievement: {
          score: assessment.score,
          objectiveAssessments: assessment.objectiveAssessments,
          risks: assessment.risks.slice(0, 3),
          improvements: assessment.improvements.slice(0, 3),
        },
      };
    }

    results.push({
      fixture: fixture.id,
      label: fixture.label,
      checks,
      splitKeywords: splitKeywords.map((k) => k.keyword),
    });
    console.log("");
  }

  const report = {
    sprint: "BL-1",
    release: "1.1",
    generatedAt: new Date().toISOString(),
    manualQaStatus: "PENDING — do not treat automated run as release PASS",
    summary: {
      fixtures: FIXTURES.length,
      checksPassed: passed,
      checksFailed: failed,
      automatedPass: failed === 0,
    },
    babyJoySample,
    results,
  };

  const outPath = path.join(OUT_DIR, "bl1-business-logic-validation-results.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("========== SUMMARY ==========");
  console.log(`Fixtures: ${FIXTURES.length}`);
  console.log(`Checks passed: ${passed}`);
  console.log(`Checks failed: ${failed}`);
  console.log(`Manual QA: PENDING`);
  console.log(`Results: ${outPath}`);
  console.log("");

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
