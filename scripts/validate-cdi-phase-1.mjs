#!/usr/bin/env node
/**
 * CDI Phase 1 validation — runs decision engine against 5 campaign fixtures.
 * Run: node scripts/validate-cdi-phase-1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "release", "cdi");

const REQUIRED_SCENARIOS = ["Original", "Client Budget Cut", "Budget +20%", "Client Creators", "Alternative Mix"];

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const {
    runDecisionEngine,
    deepFreeze,
    snapshotCampaignObject,
    validateRecommendationStructure,
    CAMPAIGN_FIXTURES,
    buildFixtureCampaignObject,
  } = await import("../features/campaign-decision-engine/index.ts");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  console.log("\n========== CDI PHASE 1 VALIDATION ==========\n");

  for (const fixture of CAMPAIGN_FIXTURES) {
    console.log(`--- ${fixture.label} (${fixture.id}) ---`);
    const checks = [];
    let passed = 0;
    let failed = 0;

    function check(name, condition, detail) {
      if (condition) {
        passed += 1;
        console.log(`  ✓ ${name}`);
      } else {
        failed += 1;
        console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
      }
      checks.push({ name, passed: condition, detail });
    }

    const campaignObject = buildFixtureCampaignObject(fixture);
    deepFreeze(campaignObject);
    const snapshotBefore = snapshotCampaignObject(campaignObject);

    const engineResult = runDecisionEngine({
      campaignObject,
      clientCreatorIds: fixture.clientCreatorIds,
    });

    const snapshotAfter = snapshotCampaignObject(campaignObject);
    check("CampaignObject not mutated", snapshotBefore === snapshotAfter);
    check("Baseline context extracted", !!engineResult.baseline.budget.total);
    check("Scenarios generated", engineResult.scenarios.length >= 5);

    for (const required of REQUIRED_SCENARIOS) {
      check(
        `Scenario "${required}" exists`,
        engineResult.scenarios.some((s) => s.name === required)
      );
    }

    const original = engineResult.scenarios.find((s) => s.name === "Original");
    const budgetCut = engineResult.scenarios.find((s) => s.name === "Client Budget Cut");
    const budgetUp = engineResult.scenarios.find((s) => s.name === "Budget +20%");

    if (original && budgetCut) {
      check(
        "Budget -20% reduces total budget",
        budgetCut.simulationResult.budget.total < original.simulationResult.budget.total
      );
      check(
        "Budget -20% reduces reach",
        budgetCut.simulationResult.kpis.reach < original.simulationResult.kpis.reach
      );
      check(
        "Budget -20% lowers Thinkway Score vs +20%",
        budgetCut.thinkwayScore.total <= budgetUp?.thinkwayScore.total ?? 100
      );
    }

    if (original && budgetUp) {
      check(
        "Budget +20% increases total budget",
        budgetUp.simulationResult.budget.total > original.simulationResult.budget.total
      );
    }

    const clientCreators = engineResult.scenarios.find((s) => s.name === "Client Creators");
    if (clientCreators) {
      check(
        "Client Creators scenario has creator changes",
        (clientCreators.changes.creatorChanges?.length ?? 0) > 0
      );
      check(
        "Client creator evaluations present",
        engineResult.clientCreatorEvaluations.length > 0
      );
    }

    const scenarioIds = new Set(engineResult.scenarios.map((s) => s.id));
    check("Scenario isolation (unique ids)", scenarioIds.size === engineResult.scenarios.length);

    let recErrors = 0;
    for (const scenario of engineResult.scenarios) {
      for (const rec of scenario.recommendations) {
        const errors = validateRecommendationStructure(rec);
        if (errors.length > 0) recErrors += 1;
      }
    }
    check("All recommendations valid structure", recErrors === 0, `${recErrors} invalid`);

    check("Comparison has winner", !!engineResult.comparison.winnerScenarioId);
    check("Approval summary generated", !!engineResult.approvalSummary.campaignHealth);

    const sampleRec = engineResult.recommendations[0];
    check("Sample recommendation has reason", !!sampleRec?.reason);
    check("Sample recommendation has confidence", (sampleRec?.confidence ?? 0) > 0);
    check("Sample recommendation has alternative", !!sampleRec?.alternative?.title);

    totalPassed += passed;
    totalFailed += failed;

    results.push({
      id: fixture.id,
      label: fixture.label,
      passed,
      failed,
      checks,
      scenarioCount: engineResult.scenarios.length,
      baselineScore: original?.thinkwayScore.total,
      winner: engineResult.comparison.rows.find((r) => r.isWinner)?.scenarioName,
      sampleRecommendation: sampleRec
        ? {
            title: sampleRec.title,
            reason: sampleRec.reason,
            confidence: sampleRec.confidence,
            impact: sampleRec.impact.summary,
            alternative: sampleRec.alternative.title,
            priority: sampleRec.priority,
          }
        : null,
      comparison: engineResult.comparison.rows.map((r) => ({
        name: r.scenarioName,
        budget: r.budget,
        reach: r.reach,
        thinkwayScore: r.thinkwayScore,
        successProbability: r.successProbability,
        isWinner: r.isWinner,
      })),
      clientCreatorEvaluations: engineResult.clientCreatorEvaluations.map((e) => ({
        creatorId: e.creatorId,
        fitScore: e.fitScore,
        replaceRecommended: e.replaceRecommended,
        reason: e.reason,
      })),
      approvalSummary: engineResult.approvalSummary,
    });
  }

  const reportJson = {
    generatedAt: new Date().toISOString(),
    totalPassed,
    totalFailed,
    status: totalFailed === 0 ? "PASS" : "FAIL",
    results,
  };

  fs.writeFileSync(path.join(OUT_DIR, "validation-results.json"), JSON.stringify(reportJson, null, 2));

  writeReports(reportJson, OUT_DIR);

  console.log(`\n========== RESULTS: ${totalPassed} passed, ${totalFailed} failed ==========\n`);
  console.log(`Reports: docs/release/cdi/`);

  if (totalFailed > 0) process.exit(1);
}

function writeReports(reportJson, outDir) {
  const { results, totalPassed, totalFailed, status } = reportJson;

  fs.writeFileSync(
    path.join(outDir, "DECISION_ENGINE_REPORT.md"),
    `# CDI Phase 1 — Decision Engine Report

Generated: ${reportJson.generatedAt}

## Status: ${status}

- Checks passed: ${totalPassed}
- Checks failed: ${totalFailed}

## Architecture

\`\`\`
CampaignObject (immutable SSOT)
       ↓ read-only
extractCampaignDecisionContext()
       ↓
ScenarioEngine (deltas only)
  ├── BudgetSimulator (±5/10/20/30%, +10/25/50%)
  ├── CreatorSimulator (remove/replace/add/posts/platform)
  └── KpiSimulator (reach, ER, CPM, ROAS, conversions)
       ↓
DecisionScore (Thinkway Score: Budget 20, Creator Fit 25, Audience 20, Risk 15, Timeline 10, KPIs 10)
       ↓
RecommendationEngine (reason, confidence, impact, pros, cons, alternative)
       ↓
DecisionEngine orchestrator → scenarios, comparison, approval summary
\`\`\`

## Immutability Enforcement

1. **Read-only extraction** — \`extractCampaignDecisionContext\` never writes to CampaignObject
2. **Snapshot verification** — JSON snapshot before/after every engine run
3. **Deep freeze** — validation script freezes fixture objects
4. **Throw on mutation** — \`DecisionEngine.run()\` throws if snapshot differs

## Campaign Results

| Campaign | Scenarios | Baseline Score | Winner | Status |
| --- | ---: | ---: | --- | --- |
${results.map((r) => `| ${r.label} | ${r.scenarioCount} | ${r.baselineScore ?? "—"} | ${r.winner ?? "—"} | ${r.failed === 0 ? "PASS" : "FAIL"} |`).join("\n")}

## Files Created

- \`features/campaign-decision-engine/decision-types.ts\`
- \`features/campaign-decision-engine/campaign-context.ts\`
- \`features/campaign-decision-engine/budget-simulator.ts\`
- \`features/campaign-decision-engine/creator-simulator.ts\`
- \`features/campaign-decision-engine/kpi-simulator.ts\`
- \`features/campaign-decision-engine/scenario-engine.ts\`
- \`features/campaign-decision-engine/decision-score.ts\`
- \`features/campaign-decision-engine/recommendation-engine.ts\`
- \`features/campaign-decision-engine/decision-engine.ts\`
- \`features/campaign-decision-engine/approval-summary.ts\`
- \`features/campaign-decision-engine/fixtures/campaign-fixtures.ts\`
- \`features/campaign-decision-engine/index.ts\`
`
  );

  fs.writeFileSync(
    path.join(outDir, "SCENARIO_VALIDATION_REPORT.md"),
    `# CDI Phase 1 — Scenario Validation Report

Generated: ${reportJson.generatedAt}

${results
  .map(
    (r) => `## ${r.label}

- Scenarios: ${r.scenarioCount}
- Checks: ${r.passed} passed, ${r.failed} failed
- Winner: **${r.winner}**

| Scenario | Budget | Reach | Thinkway Score | Success % | Winner |
| --- | ---: | ---: | ---: | ---: | --- |
${r.comparison.map((c) => `| ${c.name} | ${c.budget.toLocaleString()} | ${c.reach.toLocaleString()} | ${c.thinkwayScore} | ${c.successProbability} | ${c.isWinner ? "✓" : ""} |`).join("\n")}
`
  )
  .join("\n")}
`
  );

  fs.writeFileSync(
    path.join(outDir, "RECOMMENDATION_REPORT.md"),
    `# CDI Phase 1 — Recommendation Report

Generated: ${reportJson.generatedAt}

Every recommendation includes: title, reason, confidence, impact, pros, cons, alternative, priority.

${results
  .map(
    (r) => `## ${r.label}

### Sample Recommendation

${r.sampleRecommendation ? `- **Title:** ${r.sampleRecommendation.title}
- **Reason:** ${r.sampleRecommendation.reason}
- **Confidence:** ${r.sampleRecommendation.confidence}%
- **Impact:** ${r.sampleRecommendation.impact}
- **Alternative:** ${r.sampleRecommendation.alternative}
- **Priority:** ${r.sampleRecommendation.priority}` : "_No recommendations generated_"}

### Client Creator Evaluations

| Creator | Fit Score | Replace? | Reason |
| --- | ---: | --- | --- |
${r.clientCreatorEvaluations.map((e) => `| ${e.creatorId} | ${e.fitScore} | ${e.replaceRecommended ? "Yes" : "No"} | ${e.reason.slice(0, 80)}… |`).join("\n")}
`
  )
  .join("\n")}
`
  );

  fs.writeFileSync(
    path.join(outDir, "SIMULATION_REPORT.md"),
    `# CDI Phase 1 — Simulation Report

Generated: ${reportJson.generatedAt}

## Budget Simulation Presets

| Preset | Direction |
| --- | --- |
| -30% | Reduce budget |
| -20% | Reduce budget |
| -10% | Reduce budget |
| -5% | Reduce budget |
| +10% | Increase budget |
| +25% | Increase budget |
| +50% | Increase budget |

## Creator Simulation Actions

- remove — drop creator from mix
- replace — swap with client or Thinkway alternative
- add — add new creator
- increase_posts / decrease_posts — adjust deliverable count
- switch_platform — change primary platform

## KPI Recalculation

Reach, engagement, engagement rate, CPM, CPE, ROAS, conversions, and awareness are recalculated from budget multiplier + creator weighted reach.

${results
  .map(
    (r) => `## ${r.label}

- Baseline Thinkway Score: ${r.baselineScore}
- Approval health: ${r.approvalSummary.campaignHealth}
- Ready for approval: ${r.approvalSummary.readyForApproval ? "Yes" : "No"}
- Warnings: ${r.approvalSummary.warningsCount}
- High risks: ${r.approvalSummary.highRisksCount}
`
  )
  .join("\n")}
`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
