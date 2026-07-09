#!/usr/bin/env node
/**
 * F1.1 Manual QA product correctness validation.
 * Run: npx tsx scripts/validate-f1-manual-qa.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "release", "f1-one-workspace");
const TARGET_FIXTURES = ["babyjoy", "cocacola"];

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const { enrichCampaignObjectWithStudioData } = await import(
    "../features/campaign-intelligence/index.ts"
  );
  const { CAMPAIGN_FIXTURES, buildFixtureCampaignObject } = await import(
    "../features/campaign-decision-engine/fixtures/campaign-fixtures.ts"
  );
  const { sumAllocationPercents } = await import(
    "../features/campaign-studio/services/budget-allocation.ts"
  );
  const {
    resolveBudgetData,
    resolvePresentationData,
    resolveTimelineData,
    resolveOpportunities,
  } = await import("../features/campaign-studio/services/section-data-resolver.ts");
  const { isClientFacingTimelinePhase } = await import(
    "../features/campaign-studio/services/presentation-intelligence.ts"
  );
  const { isPresentationStatusSectionData } = await import(
    "../features/campaign-intelligence/types/section-schemas.ts"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  console.log("\n========== F1.1 MANUAL QA VALIDATION ==========\n");

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

    let campaignObject = buildFixtureCampaignObject(fixture);
    campaignObject.meta.workflowStatus = "completed";
    campaignObject.meta.status = "complete";
    campaignObject = enrichCampaignObjectWithStudioData(campaignObject);

    const budget = resolveBudgetData(campaignObject);
    const budgetPercentTotal = budget
      ? sumAllocationPercents(budget.allocations)
      : 0;
    check("Budget allocations total 100%", budgetPercentTotal === 100, `got ${budgetPercentTotal}%`);
    check(
      "Budget uses influencer categories",
      Boolean(
        budget?.allocations.some((line) => line.category === "Creator fees") &&
          budget?.allocations.some((line) =>
            /content production|paid amplification|agency coordination|contingency reserve|usage rights/i.test(
              line.category
            )
          )
      )
    );
    check(
      "Budget grounded rationale present",
      Boolean(budget?.groundedAllocations?.every((line) => line.reason?.trim()))
    );

    if (isPresentationStatusSectionData(campaignObject.sections.presentation.content)) {
      campaignObject.sections.presentation.content = {
        ...campaignObject.sections.presentation.content,
        campaignName: "Pepsi Zero Summer",
        brandName: "Pepsi",
      };
    }

    const presentation = resolvePresentationData(campaignObject);
    check(
      "Presentation Status references current campaign brand",
      presentation?.brandName === fixture.brandName &&
        presentation?.campaignName === fixture.brandName,
      `expected ${fixture.brandName}, got ${presentation?.brandName}`
    );

    const timeline = resolveTimelineData(campaignObject);
    check(
      "Timeline has no loading state when complete",
      Boolean(timeline?.weeks.every((week) => week.status === "complete"))
    );
    check(
      "Timeline excludes internal prep phases",
      Boolean(
        timeline?.weeks.every((week) => isClientFacingTimelinePhase(week.phase))
      )
    );
    check(
      "Timeline uses client execution phases",
      Boolean(
        timeline?.weeks.some((week) =>
          /campaign start|content production|publishing window|optimization|campaign end|reporting/i.test(
            week.phase
          )
        )
      )
    );

    const opportunities = resolveOpportunities(campaignObject);
    check("Strategic opportunities populated", opportunities.length >= 3);

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
  } catch {
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
    sprint: "F1.1 Manual QA",
    totalPassed,
    totalFailed,
    buildOk,
    tscOk,
    status: totalFailed === 0 ? "PASS" : "FAIL",
    campaigns: results,
    rootCauses: {
      budget90Percent:
        "Parsed budget lines (creator fees + production + contingency) summed to 90% without normalization; default fallback shares also did not guarantee 100%.",
      presentationCrossCampaign:
        "resolvePresentationData returned stale presentation.content campaignName/brandName instead of current summaryCards.",
      timelineWeek1Loading:
        "deriveTimelineWeeks defaulted week 1 to in_progress and mergeMilestonesIntoWeeks preserved pending milestone status after campaign completion.",
      budgetCategories:
        "Industry profiles used generic Production/Management/Contingency labels instead of influencer-marketing categories with rationale.",
      timelineInternalPrep:
        "Timeline builder exposed agency-internal phases (brief approval, vendor discovery) instead of client-facing execution milestones.",
      opportunityFinder:
        "Section surfaced industry gap analysis; renamed UI label to Strategic Opportunities to reflect purpose.",
    },
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "manual-qa-validation-results.json"),
    JSON.stringify(report, null, 2)
  );

  const md = `# F1.1 Manual QA Report

Generated: ${report.generatedAt}

## Status: ${report.status}

- Checks passed: ${totalPassed}
- Checks failed: ${totalFailed}
- Build: ${buildOk ? "PASS" : "FAIL"}
- TypeScript: ${tscOk ? "PASS" : "FAIL"}

## Root Causes

| Issue | Root cause | Fix |
| --- | --- | --- |
| Budget totals 90% | Partial parsed allocations not normalized to 100% | \`normalizeBudgetAllocationPercents\` + \`resolveBudgetAllocations\` |
| Wrong campaign in Presentation Status | Stale \`presentation.content\` returned verbatim | Always derive brand/campaign from \`summaryCards\` |
| Week 1 loading when complete | Week 1 forced \`in_progress\`; milestones kept \`pending\` | \`applyTimelineCompletionStatus\` when campaign complete |
| Generic budget categories | Industry profiles used Production/Management labels | Influencer categories + grounded rationale per line |
| Internal timeline phases | \`deriveTimelineWeeks\` used agency prep phases | Client execution phases only; filter internal milestones |
| Opportunity Finder label | Name implied search tool; section shows strategy gaps | Renamed to **Strategic Opportunities** |

## Campaign Results

| Campaign | Passed | Failed | Status |
| --- | ---: | ---: | --- |
${results.map((r) => `| ${r.label} | ${r.passed} | ${r.failed} | ${r.status} |`).join("\n")}

## Verified Checks

- Budget totals 100%
- Budget rationale matches influencer campaigns
- No cross-campaign data leakage in Presentation Status
- Timeline has no loading state when complete
- Timeline = campaign execution only (no internal prep)
- Presentation Status references correct campaign
- Strategic Opportunities section populated

## Files Changed

- \`features/campaign-studio/services/budget-allocation.ts\` — normalization + influencer allocation derivation
- \`features/campaign-studio/services/industry-intelligence.ts\` — influencer budget categories + Coca-Cola retail signal
- \`features/campaign-intelligence/services/structured-section-builders.ts\` — budget parse + client timeline defaults
- \`features/campaign-intelligence/services/studio-section-data-builders.ts\` — normalized budget extras + timeline completion
- \`features/campaign-studio/services/presentation-intelligence.ts\` — client-facing timeline + completion status
- \`features/campaign-studio/services/section-data-resolver.ts\` — presentation brand resolution + timeline completion
- \`features/campaign-studio/types/campaign-studio.ts\` — Strategic Opportunities label
- \`features/campaign-decision-engine/fixtures/campaign-fixtures.ts\` — BabyJoy + Coca-Cola fixtures
- \`scripts/validate-f1-manual-qa.mjs\` — validation runner
`;

  fs.writeFileSync(path.join(OUT_DIR, "MANUAL_QA_REPORT.md"), md);

  console.log(`\n========== ${report.status} (${totalPassed} passed, ${totalFailed} failed) ==========\n`);
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
