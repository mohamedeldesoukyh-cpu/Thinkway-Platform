#!/usr/bin/env node
/**
 * Release 1.1.7 — Enterprise Governance & Quality Assurance validation.
 * Run: npx tsx --import ./lib/performance/script-env-preload.ts scripts/validate-release-1-1-7-governance.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "release");

function formatMatrix(report) {
  return report.checks.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    section: c.section ?? "—",
    issue: c.issue ?? "—",
    severity: c.severity ?? "—",
  }));
}

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const { extractCampaignFacts, validateCampaignFacts } = await import(
    "../features/campaign-director/facts/index.ts"
  );
  const { runCampaignDirectorPipeline } = await import(
    "../features/campaign-director/index.ts"
  );
  const { GOVERNANCE_BRIEF_FIXTURES } = await import(
    "../features/campaign-governance/fixtures/governance-brief-fixtures.ts"
  );
  const { runGovernancePipeline } = await import(
    "../features/campaign-governance/governance-pipeline.ts"
  );
  const { buildDirectorBudgetFromStrategy } = await import(
    "../features/campaign-director/services/budget-rules.ts"
  );
  const { buildClientTimelineFromStrategy } = await import(
    "../features/campaign-director/services/timeline-rules.ts"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  const priorNarratives = [];

  console.log("\n========== RELEASE 1.1.7 ENTERPRISE GOVERNANCE ==========\n");
  console.log(`Fixtures: ${GOVERNANCE_BRIEF_FIXTURES.length}\n`);

  let approvedCount = 0;
  let rejectedCount = 0;
  let totalFails = 0;
  let totalWarnings = 0;

  for (const fixture of GOVERNANCE_BRIEF_FIXTURES) {
    console.log(`--- ${fixture.label} (${fixture.id}) ---`);

    const campaignFacts = validateCampaignFacts(
      extractCampaignFacts({
        rawMessage: fixture.rawMessage,
        brandName: fixture.brandName,
      })
    );

    const pipeline = runCampaignDirectorPipeline({
      brief: {
        rawMessage: fixture.rawMessage,
        brandName: fixture.brandName,
        campaignFacts,
      },
    });

    const budget = buildDirectorBudgetFromStrategy(
      pipeline.strategyDocument,
      fixture.rawMessage,
      campaignFacts
    );
    const timeline = buildClientTimelineFromStrategy(pipeline.strategyDocument);

    const governance =
      pipeline.governance ??
      runGovernancePipeline({
        briefText: fixture.rawMessage,
        facts: campaignFacts,
        strategy: pipeline.strategyDocument,
        specialistOutputs: pipeline.specialistOutputs,
        budget,
        timelineWeeks: timeline.length || campaignFacts.durationWeeks || 6,
        priorCampaignTexts: priorNarratives.length > 0 ? [...priorNarratives] : undefined,
      });

    priorNarratives.push(pipeline.strategyDocument.narrative);

    const qaMatrix = formatMatrix(governance.qaReport);
    const complianceMatrix = formatMatrix(governance.complianceReport);
    const presentationMatrix = formatMatrix(governance.presentationReport);

    const decision = governance.directorApproval.decision;
    if (decision.approved) approvedCount++;
    else rejectedCount++;

    totalFails += decision.failCount;
    totalWarnings += decision.warningCount;

    console.log(`  QA:          ${governance.qaReport.summary.pass}P / ${governance.qaReport.summary.warning}W / ${governance.qaReport.summary.fail}F`);
    console.log(`  Compliance:  ${governance.complianceReport.summary.pass}P / ${governance.complianceReport.summary.warning}W / ${governance.complianceReport.summary.fail}F`);
    console.log(`  Presentation:${governance.presentationReport.summary.pass}P / ${governance.presentationReport.summary.warning}W / ${governance.presentationReport.summary.fail}F`);
    console.log(`  Quality Score: ${governance.qualityScore.overall}/100`);
    console.log(`  Director Approval: ${decision.approved ? "APPROVED" : "REJECTED (revision required)"}`);
    if (decision.blockers.length) {
      console.log(`  Blockers: ${decision.blockers.slice(0, 3).join("; ")}`);
    }
    console.log("");

    results.push({
      fixture: fixture.id,
      label: fixture.label,
      qaMatrix,
      complianceMatrix,
      presentationMatrix,
      qualityScore: governance.qualityScore,
      directorApproval: governance.directorApproval,
      pipelineApproved: pipeline.approvalGate.approved,
      releaseApproved: governance.releaseApproved,
    });
  }

  const outPath = path.join(OUT_DIR, "release-1-1-7-governance-validation-results.json");
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  console.log("========== SUMMARY ==========");
  console.log(`Fixtures run:     ${GOVERNANCE_BRIEF_FIXTURES.length}`);
  console.log(`Director approved:${approvedCount}`);
  console.log(`Director rejected:${rejectedCount}`);
  console.log(`Total FAILs:      ${totalFails}`);
  console.log(`Total WARNINGs:   ${totalWarnings}`);
  console.log(`Results written:  ${outPath}`);
  console.log("\nNOTE: Validation reports outcomes only — does NOT claim PASS.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
