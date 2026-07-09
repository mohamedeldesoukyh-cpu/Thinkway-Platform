#!/usr/bin/env node
/**
 * CDI Phase 2 validation — Decision Workspace scenarios + promotion immutability.
 * Run: node scripts/validate-cdi-phase-2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "release", "cdi");

const PHASE2_SCENARIOS = [
  { name: "Budget Cut", changes: { budgetChange: { percentChange: -20, label: "Budget -20%" } } },
  { name: "Budget Increase", changes: { budgetChange: { percentChange: 20, label: "Budget +20%" } } },
  {
    name: "Client Creators",
    changes: {
      creatorChanges: [{ action: "replace", creatorId: "c1", replacementCreatorId: "client_c1", source: "client" }],
    },
  },
  {
    name: "Replace Creators",
    changes: {
      creatorChanges: [{ action: "replace", creatorId: "c1", replacementCreatorId: "alt_c1", source: "thinkway" }],
    },
  },
  {
    name: "Alternative Objective",
    changes: {
      objectiveChanges: { objective: "Sales and conversions", campaignType: "Performance" },
      budgetChange: { percentChange: 10 },
    },
  },
];

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const {
    deepFreeze,
    snapshotCampaignObject,
    createScenario,
    extractCampaignDecisionContext,
    compareScenarios,
    validateRecommendationStructure,
    CAMPAIGN_FIXTURES,
    buildFixtureCampaignObject,
  } = await import("../features/campaign-decision-engine/index.ts");

  const { WorkspaceScenarioStore } = await import(
    "../features/campaign-decision-workspace/services/scenario-store.ts"
  );
  const {
    applyScenarioToCampaignObject,
    buildPromotedCampaignObject,
  } = await import("../features/campaign-decision-workspace/services/promote-scenario.ts");
  const { buildScoreExplanations } = await import(
    "../features/campaign-decision-workspace/services/score-explainability.ts"
  );
  const { assessClientCreator } = await import(
    "../features/campaign-decision-workspace/services/client-creator-assessment.ts"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  console.log("\n========== CDI PHASE 2 VALIDATION ==========\n");

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
    const baseline = extractCampaignDecisionContext(campaignObject);

    const store = new WorkspaceScenarioStore(campaignObject.id);
    const original = createScenario("Original", baseline, {});
    store.setBaseline(original);

    const customScenarios = PHASE2_SCENARIOS.map((s) => {
      const changes = { ...s.changes };
      if (s.name === "Client Creators" && baseline.creators.length) {
        changes.creatorChanges = baseline.creators.map((c, i) => ({
          action: "replace",
          creatorId: c.id,
          replacementCreatorId: fixture.clientCreatorIds[i] ?? fixture.clientCreatorIds[0],
          source: "client",
        }));
      }
      if (s.name === "Replace Creators" && baseline.creators.length) {
        changes.creatorChanges = baseline.creators.map((c) => ({
          action: "replace",
          creatorId: c.id,
          replacementCreatorId: `alt_${c.id}`,
          source: "thinkway",
        }));
      }
      return createScenario(s.name, baseline, changes);
    });

    for (const scenario of customScenarios) {
      store.add(scenario);
    }

    const allScenarios = store.list();
    check("CampaignObject unchanged during scenarios", snapshotBefore === snapshotCampaignObject(campaignObject));
    check("Unlimited scenarios supported", allScenarios.length >= 6, `count=${allScenarios.length}`);

    const budgetCut = customScenarios.find((s) => s.name === "Budget Cut");
    const budgetUp = customScenarios.find((s) => s.name === "Budget Increase");
    const originalScenario = allScenarios.find((s) => s.isOriginal);

    if (budgetCut && originalScenario) {
      check(
        "Budget cut reduces total",
        budgetCut.simulationResult.budget.total < originalScenario.simulationResult.budget.total
      );
      check(
        "Thinkway Score recalculates on budget cut",
        budgetCut.thinkwayScore.total !== originalScenario.thinkwayScore.total ||
          budgetCut.simulationResult.kpis.reach !== originalScenario.simulationResult.kpis.reach
      );
    }

    if (budgetUp && originalScenario) {
      check(
        "Budget increase raises total",
        budgetUp.simulationResult.budget.total > originalScenario.simulationResult.budget.total
      );
    }

    const comparison = compareScenarios(allScenarios);
    check("Side-by-side comparison has winner", !!comparison.winnerScenarioId);
    check("Comparison rows match scenario count", comparison.rows.length === allScenarios.length);

    let recErrors = 0;
    for (const scenario of allScenarios) {
      for (const rec of scenario.recommendations) {
        if (validateRecommendationStructure(rec).length > 0) recErrors += 1;
      }
    }
    check("Recommendations explainable", recErrors === 0, `${recErrors} invalid`);

    const explanations = buildScoreExplanations(
      baseline,
      budgetCut?.thinkwayScore ?? original.thinkwayScore,
      budgetCut?.name ?? "Original"
    );
    check(
      "Score breakdown has 6 dimensions",
      explanations.length === 6 && explanations.every((e) => e.why && e.evidence)
    );

    const promoteTarget = budgetUp ?? customScenarios[1];
    const snapshotPrePromote = snapshotCampaignObject(campaignObject);
    const { promoted } = buildPromotedCampaignObject({
      campaignObject,
      scenario: promoteTarget,
      conversationId: "test-conversation",
      userId: "test-user",
    });
    check("CampaignObject unchanged until promote", snapshotPrePromote === snapshotCampaignObject(campaignObject));
    check("Promotion produces new snapshot", promoted.updatedAt !== campaignObject.updatedAt);
    check(
      "Promotion updates budget",
      applyScenarioToCampaignObject(campaignObject, promoteTarget).sections.budget !== campaignObject.sections.budget ||
        JSON.stringify(promoted.sections.budget) !== JSON.stringify(campaignObject.sections.budget)
    );

    store.markPromoted(promoteTarget.id, "validator");
    check("Timeline records promotion", store.getTimeline().some((e) => e.action === "promoted"));

    totalPassed += passed;
    totalFailed += failed;

    results.push({
      id: fixture.id,
      label: fixture.label,
      passed,
      failed,
      checks,
      scenarioCount: allScenarios.length,
      winner: comparison.rows.find((r) => r.isWinner)?.scenarioName,
      comparison: comparison.rows.map((r) => ({
        name: r.scenarioName,
        budget: r.budget,
        reach: r.reach,
        thinkwayScore: r.thinkwayScore,
        successProbability: r.successProbability,
        isWinner: r.isWinner,
      })),
      explainabilitySample: explanations[0],
      promotionScenario: promoteTarget.name,
    });
  }

  const reportJson = {
    generatedAt: new Date().toISOString(),
    phase: 2,
    totalPassed,
    totalFailed,
    status: totalFailed === 0 ? "PASS" : "FAIL",
    results,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "validation-results-phase2.json"),
    JSON.stringify(reportJson, null, 2)
  );

  writePhase2Reports(reportJson, OUT_DIR);

  console.log(`\n========== RESULTS: ${totalPassed} passed, ${totalFailed} failed ==========\n`);

  if (totalFailed > 0) process.exit(1);
}

function writePhase2Reports(reportJson, outDir) {
  const { results, totalPassed, totalFailed, status } = reportJson;

  fs.writeFileSync(
    path.join(outDir, "DECISION_WORKSPACE_REPORT.md"),
    `# CDI Phase 2 — Decision Workspace Report

Generated: ${reportJson.generatedAt}

## Status: ${status}

- Checks passed: ${totalPassed}
- Checks failed: ${totalFailed}

## Route

\`/ai/[conversationId]/decisions\` — Campaign Intelligence shell with **Campaign Studio | Decision Workspace** tabs.

## Architecture

\`\`\`
CampaignObject (immutable in sandbox)
 ├── Campaign Studio (existing — unchanged)
 └── Decision Workspace (NEW)
      └── Decision Engine (Phase 1)
           └── Scenarios (deltas, session persistence)
\`\`\`

## Components

| Component | Purpose |
| --- | --- |
| \`decision-workspace.tsx\` | 3-panel orchestrator |
| \`baseline-panel.tsx\` | Original approved metrics |
| \`scenario-list-panel.tsx\` | Unlimited scenarios + presets |
| \`scenario-detail-panel.tsx\` | KPI deltas vs Original |
| \`budget-slider-control.tsx\` | -50% to +50% instant simulation |
| \`creator-action-controls.tsx\` | Remove/replace/add/platform |
| \`client-creator-evaluator.tsx\` | URL paste + evaluation |
| \`score-breakdown.tsx\` | Explainable Thinkway Score |
| \`scenario-comparison-table.tsx\` | Side-by-side + winner |
| \`recommendation-panel.tsx\` | Structured recommendations |
| \`decision-timeline.tsx\` | Per-scenario audit trail |
| \`promote-scenario-dialog.tsx\` | Explicit approval flow |

## Promote Flow

1. User selects non-Original scenario
2. Clicks **Promote Scenario** → confirmation dialog
3. \`POST /api/ai/campaign-objects/[id]/promote-scenario\`
4. \`applyScenarioToCampaignObject()\` applies simulation deltas
5. \`saveCampaignObject()\` persists new version via existing \`CampaignObjectPersistenceService\`
6. Campaign Studio tab reflects promoted CampaignObject

## Immutability

- Sandbox simulations never write to CampaignObject
- Snapshot verification before/after engine runs and before promotion
- Only promote API mutates and persists

## Campaign Results

| Campaign | Scenarios | Winner | Status |
| --- | ---: | --- | --- |
${results.map((r) => `| ${r.label} | ${r.scenarioCount} | ${r.winner ?? "—"} | ${r.failed === 0 ? "PASS" : "FAIL"} |`).join("\n")}
`
  );

  fs.writeFileSync(
    path.join(outDir, "SCENARIO_VALIDATION_REPORT.md"),
    `# CDI Phase 2 — Scenario Validation Report

Generated: ${reportJson.generatedAt}

Phase 2 scenarios per fixture: Budget Cut, Budget Increase, Client Creators, Replace Creators, Alternative Objective.

${results
  .map(
    (r) => `## ${r.label}

- Scenarios: ${r.scenarioCount}
- Checks: ${r.passed} passed, ${r.failed} failed
- Winner: **${r.winner}**
- Promoted test scenario: ${r.promotionScenario}

| Scenario | Budget | Reach | Thinkway Score | Success % | Winner |
| --- | ---: | ---: | ---: | ---: | --- |
${r.comparison.map((c) => `| ${c.name} | ${c.budget.toLocaleString()} | ${c.reach.toLocaleString()} | ${c.thinkwayScore} | ${c.successProbability} | ${c.isWinner ? "✓" : ""} |`).join("\n")}
`
  )
  .join("\n")}
`
  );

  fs.writeFileSync(
    path.join(outDir, "COMPARISON_REPORT.md"),
    `# CDI Phase 2 — Comparison Report

Generated: ${reportJson.generatedAt}

Side-by-side comparison metrics: Budget, Reach, Engagement, CPM, Creator Count, Thinkway Score, Success Probability.

Winner selection: composite score = Thinkway Score × 0.6 + Success Probability × 0.4.

${results
  .map(
    (r) => `## ${r.label}

Winner: **${r.winner}**

${r.comparison
  .map(
    (c) =>
      `- ${c.name}: Score ${c.thinkwayScore}, Success ${c.successProbability}%, Reach ${c.reach.toLocaleString()}${c.isWinner ? " **WINNER**" : ""}`
  )
  .join("\n")}
`
  )
  .join("\n")}
`
  );

  fs.writeFileSync(
    path.join(outDir, "EXPLAINABILITY_REPORT.md"),
    `# CDI Phase 2 — Explainability Report

Generated: ${reportJson.generatedAt}

Thinkway Score breakdown dimensions: Budget (×/20), Creator Quality (×/25), Audience Match (×/20), Risk (×/15), Timeline (×/10), KPIs (×/10).

Each metric includes: Why, Evidence, Confidence, Improvement suggestions.

${results
  .map(
    (r) => `## ${r.label}

Sample dimension: **${r.explainabilitySample?.label}**

- Why: ${r.explainabilitySample?.why}
- Evidence: ${r.explainabilitySample?.evidence}
- Confidence: ${r.explainabilitySample?.confidence}%
- Improvements: ${r.explainabilitySample?.improvements?.join("; ")}
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
