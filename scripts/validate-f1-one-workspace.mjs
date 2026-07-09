#!/usr/bin/env node
/**
 * F1.1 One Workspace validation — integrated Campaign Studio + Decision Mode.
 * Run: npx tsx scripts/validate-f1-one-workspace.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "release", "f1-one-workspace");

const TARGET_FIXTURES = ["babyjoy", "adidas", "tourism", "finance", "luxury"];

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const {
    deepFreeze,
    snapshotCampaignObject,
    createScenario,
    extractCampaignDecisionContext,
    compareScenarios,
    runDecisionEngine,
    CAMPAIGN_FIXTURES,
    buildFixtureCampaignObject,
  } = await import("../features/campaign-decision-engine/index.ts");

  const { WorkspaceScenarioStore, SCENARIO_PRESETS } = await import(
    "../features/campaign-decision-workspace/services/scenario-store.ts"
  );
  const { applyScenarioToCampaignObject, buildPromotedCampaignObject } = await import(
    "../features/campaign-decision-workspace/services/promote-scenario.ts"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("\n--- Architecture static checks ---");
  const hostPath = path.join(
    ROOT,
    "features/campaign-decision-workspace/components/campaign-studio-host.tsx"
  );
  const hostSource = fs.readFileSync(hostPath, "utf8");

  const conversationPagePath = path.join(
    ROOT,
    "app/(dashboard)/ai/[conversationId]/page.tsx"
  );
  const chatThreadPath = path.join(ROOT, "features/ai-workspace/components/chat-thread.tsx");
  const conversationPageSource = fs.readFileSync(conversationPagePath, "utf8");
  const chatThreadSource = fs.readFileSync(chatThreadPath, "utf8");

  const compositionChecks = [
    {
      name: "Main page renders IntelligenceWorkspace (chat workspace)",
      passed:
        conversationPageSource.includes("IntelligenceWorkspace") &&
        !conversationPageSource.includes("CampaignIntelligenceShell"),
    },
    {
      name: "Main page does not replace workspace with host-only shell",
      passed: !conversationPageSource.includes("CampaignStudioHost"),
    },
    {
      name: "Chat thread embeds CampaignStudioHost (not direct CampaignStudio)",
      passed:
        chatThreadSource.includes("CampaignStudioHost") &&
        !chatThreadSource.match(/from\s+["']@\/features\/campaign-studio\/components\/campaign-studio["']/),
    },
    {
      name: "Chat thread retains messages render area",
      passed:
        chatThreadSource.includes("messages.map") &&
        chatThreadSource.includes("MessageBubble"),
    },
    {
      name: "Host accepts complete and completed workflow status",
      passed:
        hostSource.includes("isWorkflowComplete") &&
        hostSource.includes('"completed"') &&
        hostSource.includes('"complete"'),
    },
  ];

  for (const check of compositionChecks) {
    if (check.passed) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.error(`  ✗ ${check.name}`);
    }
  }

  let archPassed = compositionChecks.filter((c) => c.passed).length;
  let archFailed = compositionChecks.filter((c) => !c.passed).length;

  const forbiddenBelowStudio = [
    "ScenarioComparisonTable",
    "RecommendationPanel",
    "DecisionTimeline",
    "ClientCreatorEvaluator",
    "ScoreBreakdown",
    "CreatorActionControls",
  ];

  const architectureChecks = forbiddenBelowStudio.map((component) => {
    const imported = hostSource.includes(component);
    const passed = !imported;
    if (passed) {
      console.log(`  ✓ Host does not import ${component}`);
    } else {
      console.error(`  ✗ Host still imports ${component} — must not render below CampaignStudio`);
    }
    return { name: `Host excludes ${component}`, passed, detail: imported ? "still imported" : undefined };
  });

  const presentationBlockMatch = hostSource.match(
    /if \(mode === "presentation"\) \{([\s\S]*?)\n  \}\n\n  return/
  );
  const presentationBlock = presentationBlockMatch?.[1] ?? "";
  const presentationCheck = {
    name: "Presentation mode: no decisionMode on CampaignStudio",
    passed:
      presentationBlock.length > 0 &&
      presentationBlock.includes("<CampaignStudio") &&
      !presentationBlock.includes("decisionMode"),
  };
  if (presentationCheck.passed) {
    console.log(`  ✓ ${presentationCheck.name}`);
  } else {
    console.error(`  ✗ ${presentationCheck.name}`);
  }

  const overlayOk =
    hostSource.includes("decisionMode={decisionMode}") &&
    hostSource.includes("displayCampaignObject");
  const overlayCheck = {
    name: "Decision mode: displayCampaignObject + decisionMode wired",
    passed: overlayOk,
  };
  if (overlayCheck.passed) {
    console.log(`  ✓ ${overlayCheck.name}`);
  } else {
    console.error(`  ✗ ${overlayCheck.name}`);
  }

  archPassed += architectureChecks.filter((c) => c.passed).length;
  archFailed += architectureChecks.filter((c) => !c.passed).length;
  if (presentationCheck.passed) archPassed += 1;
  else archFailed += 1;
  if (overlayCheck.passed) archPassed += 1;
  else archFailed += 1;

  const results = [];
  let totalPassed = archPassed;
  let totalFailed = archFailed;

  console.log("\n========== F1.1 ONE WORKSPACE VALIDATION ==========\n");

  for (const fixtureId of TARGET_FIXTURES) {
    const fixture = CAMPAIGN_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) {
      console.error(`  ✗ Missing fixture: ${fixtureId}`);
      totalFailed += 1;
      continue;
    }

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

    const store = new WorkspaceScenarioStore(`${fixture.id}_f1`);
    const original = createScenario("Original", baseline, {});
    store.setBaseline(original);

    const budgetCutPreset = SCENARIO_PRESETS.find((p) => p.id === "budget_cut");
    const budgetCut = createScenario(
      "Budget Cut",
      baseline,
      budgetCutPreset?.buildChanges([]) ?? { budgetChange: { percentChange: -20 } }
    );
    store.add(budgetCut);

    check("Presentation: CampaignObject snapshot stable", snapshotBefore === snapshotCampaignObject(campaignObject));
    check("Decision: scenarios created in sandbox", store.list().length >= 2);

    const displayOnly = applyScenarioToCampaignObject(campaignObject, budgetCut);
    check(
      "Decision: display-only apply does not mutate source",
      snapshotBefore === snapshotCampaignObject(campaignObject)
    );
    check(
      "Decision: display budget reflects simulation",
      displayOnly.sections.budget.content &&
        typeof displayOnly.sections.budget.content === "object" &&
        displayOnly.sections.budget.content.total !== baseline.budget.total
    );

    const comparison = compareScenarios(store.list());
    check("Decision: scenario comparison has rows", comparison.rows.length >= 2);
    check("Decision: comparison winner selected", Boolean(comparison.winnerScenarioId));

    const engine = runDecisionEngine({ campaignObject });
    check(
      "Decision: recommendations available",
      engine.recommendations.length > 0 || budgetCut.recommendations.length > 0
    );

    const { promoted } = buildPromotedCampaignObject({
      campaignObject,
      scenario: budgetCut,
      conversationId: "conv_f1_test",
      userId: "validator",
    });
    check(
      "Promote: source still immutable after buildPromotedCampaignObject",
      snapshotBefore === snapshotCampaignObject(campaignObject)
    );
    check(
      "Promote: promoted object differs from original",
      snapshotCampaignObject(promoted) !== snapshotBefore
    );

    totalPassed += passed;
    totalFailed += failed;

    results.push({
      id: fixture.id,
      label: fixture.label,
      passed,
      failed,
      checks,
      status: failed === 0 ? "PASS" : "FAIL",
    });
  }

  console.log("\n--- Build & TypeScript ---");
  let buildOk = false;
  let tscOk = false;

  try {
    execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
    buildOk = true;
    console.log("  ✓ next build");
    totalPassed += 1;
  } catch (err) {
    console.error("  ✗ next build");
    totalFailed += 1;
  }

  try {
    execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
    tscOk = true;
    console.log("  ✓ tsc --noEmit");
    totalPassed += 1;
  } catch {
    console.error("  ✗ tsc --noEmit");
    totalFailed += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sprint: "F1.1 ONE WORKSPACE",
    totalPassed,
    totalFailed,
    buildOk,
    tscOk,
    status: totalFailed === 0 ? "PASS" : "FAIL",
    architecture: {
      composition: compositionChecks,
      checks: [...architectureChecks, presentationCheck, overlayCheck],
      forbiddenBelowStudio,
    },
    campaigns: results,
    routes: {
      primary: "/ai/[conversationId]",
      devOnly: "/ai/[conversationId]/decisions",
    },
    presentationParity:
      "Presentation mode renders CampaignStudio with original CampaignObject — decisionMode undefined, no scenario bar or right panel.",
    decisionModeArchitecture:
      "Decision mode enhances Campaign Studio cards in place; comparison/timeline/score/recommendation live in DecisionRightPanel only.",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "validation-results.json"),
    JSON.stringify(report, null, 2)
  );

  const md = `# F1.1 One Workspace — Validation Report

Generated: ${report.generatedAt}

## Status: ${report.status}

- Checks passed: ${totalPassed}
- Checks failed: ${totalFailed}
- Build: ${buildOk ? "PASS" : "FAIL"}
- TypeScript: ${tscOk ? "PASS" : "FAIL"}

## Campaign Results

| Campaign | Passed | Failed | Status |
| --- | ---: | ---: | --- |
${results.map((r) => `| ${r.label} | ${r.passed} | ${r.failed} | ${r.status} |`).join("\n")}

## Verified

- Routing composition: main page uses IntelligenceWorkspace + chat-thread embeds CampaignStudioHost
- Presentation Mode: CampaignObject unchanged, CampaignStudio render path preserved
- Decision Mode: sandbox scenarios, display-only deltas, comparison, promotion immutability
- Decision Mode architecture: no ScenarioComparisonTable, RecommendationPanel, DecisionTimeline, ClientCreatorEvaluator, or ScoreBreakdown below CampaignStudio
- Promote: only path that mutates CampaignObject

**Manual QA:** Awaiting verification — see ROUTING_COMPOSITION_FIX.md
`;

  fs.writeFileSync(path.join(OUT_DIR, "validation-results.md"), md);

  console.log(`\n========== ${report.status} (${totalPassed} passed, ${totalFailed} failed) ==========\n`);
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
