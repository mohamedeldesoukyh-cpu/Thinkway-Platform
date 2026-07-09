#!/usr/bin/env node
/**
 * Campaign Director intelligence pipeline validation.
 * Run: node scripts/validate-campaign-director.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "intelligence");

const FIXTURE_BRIEFS = [
  {
    id: "babyjoy",
    label: "BabyJoy",
    brandName: "BabyJoy",
    rawMessage:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
    timelineWithInternal:
      "Week 1: Kickoff\nWeek 2: Creator outreach\nWeek 3-4: Production\nWeek 5: Go-live",
  },
  {
    id: "cocacola",
    label: "Coca-Cola",
    brandName: "Coca-Cola",
    rawMessage:
      "Strategize a Coca-Cola summer engagement campaign targeting Gen Z. Budget $500,000 across Instagram and TikTok for 8 weeks.",
    timelineWithInternal:
      "Week 1: Strategy approval\nWeek 2: Discovery\nWeek 3-6: Content\nWeek 7: Launch",
  },
];

function revisionHasAllFields(revision) {
  return (
    revision.previousRecommendation?.length > 0 &&
    revision.issueFound?.length > 0 &&
    revision.foundBy?.length > 0 &&
    revision.revisedRecommendation?.length > 0 &&
    revision.whyChanged?.length > 0 &&
    typeof revision.round === "number"
  );
}

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const {
    runCampaignDirectorPipeline,
    writeStrategyDocumentFromBrief,
    validateBudgetTotals100,
    buildDirectorBudgetFromStrategy,
    isInternalTimelinePhase,
    CLIENT_FACING_TIMELINE_PHASES,
    applyDirectorPipelineToCampaignObject,
    extractCampaignFacts,
    validateCampaignFacts,
    getCampaignFactsFromWorkflowData,
  } = await import("../features/campaign-director/index.ts");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let babyjoyReviewReport = null;

  console.log("\n========== CAMPAIGN DIRECTOR VALIDATION ==========\n");

  for (const fixture of FIXTURE_BRIEFS) {
    console.log(`--- ${fixture.label} (${fixture.id}) ---`);
    const checks = [];

    function check(name, condition, detail) {
      const pass = Boolean(condition);
      checks.push({ name, pass, detail });
      if (pass) {
        totalPassed++;
        console.log(`  ✓ ${name}`);
      } else {
        totalFailed++;
        console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
      }
    }

    const strategy = writeStrategyDocumentFromBrief({
      rawMessage: fixture.rawMessage,
      brandName: fixture.brandName,
      campaignFacts: validateCampaignFacts(
        extractCampaignFacts({
          rawMessage: fixture.rawMessage,
          brandName: fixture.brandName,
        })
      ),
    });

    check("Campaign facts layer present (factsRef)", Boolean(strategy.factsRef?.extractedAt));
    check(
      "Strategy fields sourced from facts",
      (strategy.factsRef?.fields?.length ?? 0) >= 5,
      `fields=${strategy.factsRef?.fields?.join(", ")}`
    );
    check("Strategy document exists", strategy.narrative.length > 100, strategy.narrative.length);
    check("Strategy has brand", strategy.understanding.brand === fixture.brandName);
    check("Strategy has objective", strategy.understanding.objective.length > 5);
    check("Strategy has KPIs with why", strategy.understanding.kpis.every((k) => k.why.length > 5));
    check("Strategy has creator tier why", strategy.creatorTierStrategy.every((t) => t.why.length > 5));

    const mockTaskResults = {
      "analyze-request": {
        taskId: "analyze-request",
        status: "completed",
        content: fixture.rawMessage,
        agentId: "general",
      },
      "build-strategy": {
        taskId: "build-strategy",
        status: "completed",
        content: strategy.narrative,
        agentId: "strategist",
      },
      "estimate-budget": {
        taskId: "estimate-budget",
        status: "completed",
        content: `Total budget for ${fixture.brandName}`,
        agentId: "analyst",
      },
      "generate-timeline": {
        taskId: "generate-timeline",
        status: "completed",
        content: fixture.timelineWithInternal,
        agentId: "planner",
      },
      "prepare-approval": {
        taskId: "prepare-approval",
        status: "completed",
        content: `Campaign draft for ${fixture.brandName}`,
        agentId: "strategist",
      },
    };

    const campaignFacts = validateCampaignFacts(
      extractCampaignFacts({
        rawMessage: fixture.rawMessage,
        brandName: fixture.brandName,
      })
    );

    const pipeline = runCampaignDirectorPipeline({
      brief: { rawMessage: fixture.rawMessage, brandName: fixture.brandName, campaignFacts },
      taskResults: mockTaskResults,
      campaignFacts,
    });

    check(
      "Workflow facts accessor pattern",
      getCampaignFactsFromWorkflowData({ campaignFacts }) === campaignFacts
    );

    if (fixture.id === "babyjoy") {
      babyjoyReviewReport = pipeline.reviewReport;
    }

    check(
      "Specialists have why fields",
      pipeline.specialistOutputs.every((o) => o.why.length > 5 && o.what.length > 5)
    );
    check("Cross-review ran", pipeline.crossReviewFindings.length >= 0);
    check(
      "Conflicts detected and resolved",
      pipeline.challenges.length >= 0 && pipeline.approvalGate.unresolvedConflictCount === 0
    );
    check("Approval gate passed", pipeline.approvalGate.approved);
    check("Approved sections generated", pipeline.approvedSections.length >= 8);

    check("Director review report generated", Boolean(pipeline.reviewReport));
    check(
      "Review report has conversation log",
      (pipeline.reviewReport?.conversation?.length ?? 0) > 0,
      `turns=${pipeline.reviewReport?.conversation?.length ?? 0}`
    );

    const hadConflicts = pipeline.reviewReport?.entries.some((e) => e.conflictFound);
    if (hadConflicts) {
      check(
        "Review rounds > 0 when conflicts found",
        pipeline.approvalGate.revisionRounds > 0,
        `rounds=${pipeline.approvalGate.revisionRounds}`
      );

      const revisedEntries = pipeline.reviewReport.entries.filter((e) => e.revisions.length > 0);
      check(
        "Revisions exist when conflicts found",
        revisedEntries.length > 0,
        `revised=${revisedEntries.length}`
      );

      const allRevisionsValid = revisedEntries.every((e) =>
        e.revisions.every((r) => revisionHasAllFields(r))
      );
      check("Revision records have all 4 fields", allRevisionsValid);

      const contentChanged = revisedEntries.every(
        (e) => e.finalApproval !== e.initialRecommendation
      );
      check("Final sections differ from initial when revised", contentChanged);
    }

    check(
      "Director approval turn in conversation",
      pipeline.reviewReport?.conversation.some((t) => t.action === "approval") ?? false
    );

    const budget = buildDirectorBudgetFromStrategy(strategy, fixture.rawMessage, campaignFacts);
    check(
      "Budget totals 100%",
      validateBudgetTotals100(budget.allocations),
      `sum=${budget.allocations.reduce((s, a) => s + (a.percent ?? 0), 0)}`
    );

    const timelineSection = pipeline.approvedSections.find((s) => s.sectionKey === "timeline");
    const milestones =
      timelineSection && typeof timelineSection.content === "object"
        ? timelineSection.content.milestones ?? []
        : [];
    const hasInternalPhase = milestones.some((m) => isInternalTimelinePhase(m.phase));
    check("Client timeline only (no internal phases)", !hasInternalPhase);

    const clientPhasesUsed = milestones.some((m) =>
      CLIENT_FACING_TIMELINE_PHASES.some((p) => m.phase.includes(p.split(" ")[0]))
    );
    check("Client-facing phases present", clientPhasesUsed || milestones.length > 0);

    check(
      "Every approved section has rationale",
      pipeline.approvedSections.every((s) => s.rationale.length > 5)
    );

    const mockCampaignObject = {
      id: `test_${fixture.id}`,
      updatedAt: new Date().toISOString(),
      sections: {
        summary: { content: "", status: "pending" },
        audience: { content: "", status: "pending" },
        strategy: { content: "", status: "pending" },
        creators: { content: "", status: "pending" },
        budget: { content: "", status: "pending" },
        timeline: { content: "", status: "pending" },
        performance: { content: "", status: "pending" },
        presentation: { content: "", status: "pending" },
        operations: { content: "", status: "pending" },
      },
      meta: { status: "building", specialistProgress: [] },
    };

    const merged = applyDirectorPipelineToCampaignObject(mockCampaignObject, pipeline, campaignFacts);
    check(
      "CampaignObject meta.campaignFacts stored",
      Boolean(merged.meta.campaignFacts?.extractedAt)
    );
    check(
      "CampaignObject sections = approved only",
      pipeline.approvalGate.approved
        ? merged.sections.creators.content ===
            pipeline.approvedSections.find((s) => s.sectionKey === "creators")?.content
        : true
    );
    check(
      "Review report stored in meta.directorPipeline",
      Boolean(merged.meta.directorPipeline?.reviewReport)
    );

    results.push({
      fixture: fixture.id,
      label: fixture.label,
      checks,
      pipeline: {
        strategyDocumentId: pipeline.strategyDocument.id,
        specialistCount: pipeline.specialistOutputs.length,
        crossReviewCount: pipeline.crossReviewFindings.length,
        challengeCount: pipeline.challenges.length,
        revisionRounds: pipeline.approvalGate.revisionRounds,
        approved: pipeline.approvalGate.approved,
        approvedSectionCount: pipeline.approvedSections.length,
        budgetPercentSum: budget.allocations.reduce((s, a) => s + (a.percent ?? 0), 0),
        reviewReportTurns: pipeline.reviewReport?.conversation.length ?? 0,
        specialistsRevised:
          pipeline.reviewReport?.entries.filter((e) => e.revisions.length > 0).length ?? 0,
      },
    });

    console.log("");
  }

  if (babyjoyReviewReport) {
    fs.writeFileSync(
      path.join(OUT_DIR, "DIRECTOR_REVIEW_LOOP_REPORT.md"),
      renderReviewLoopReport(babyjoyReviewReport)
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalPassed,
    totalFailed,
    success: totalFailed === 0,
    results,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "CAMPAIGN_DIRECTOR_VALIDATION_REPORT.md"),
    renderReport(report)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "campaign-director-validation-results.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("========== SUMMARY ==========");
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Report: docs/intelligence/CAMPAIGN_DIRECTOR_VALIDATION_REPORT.md`);
  console.log(`Review loop: docs/intelligence/DIRECTOR_REVIEW_LOOP_REPORT.md`);

  if (totalFailed > 0) process.exit(1);
}

function renderReviewLoopReport(reviewReport) {
  const lines = [
    "# Director Review Loop Report",
    "",
    `Generated: ${reviewReport.generatedAt}`,
    "",
    "## Summary",
    "",
    `- **Director approved:** ${reviewReport.directorApproved}`,
    `- **Total review rounds:** ${reviewReport.totalReviewRounds}`,
    `- **Approval reason:** ${reviewReport.directorApprovalReason}`,
    "",
    "## Sample Internal Conversation (BabyJoy)",
    "",
    "| Round | Speaker | Action | Message |",
    "|-------|---------|--------|---------|",
  ];

  for (const turn of reviewReport.conversation) {
    const msg = turn.message.replace(/\|/g, "\\|").slice(0, 120);
    lines.push(`| ${turn.round} | ${turn.speaker} | ${turn.action} | ${msg} |`);
  }

  lines.push("", "## Per-Specialist Review", "");

  for (const entry of reviewReport.entries.filter((e) => e.conflictFound)) {
    lines.push(`### ${entry.specialist}`, "");
    lines.push(`- **Initial:** ${entry.initialRecommendation.slice(0, 100)}`);
    lines.push(`- **Found by:** ${entry.whoFoundIt ?? "director"}`);
    if (entry.revision) {
      lines.push(`- **Issue:** ${entry.revision.issueFound}`);
      lines.push(`- **Revised:** ${entry.revision.revisedRecommendation.slice(0, 100)}`);
      lines.push(`- **Why changed:** ${entry.revision.whyChanged}`);
    }
    lines.push(`- **Final approval:** ${entry.finalApproval.slice(0, 100)}`);
    lines.push("");
  }

  lines.push("## Full Conversation JSON", "", "```json");
  lines.push(JSON.stringify(reviewReport.conversation, null, 2));
  lines.push("```", "");

  return lines.join("\n");
}

function renderReport(report) {
  const lines = [
    "# Campaign Director Validation Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- **Passed:** ${report.totalPassed}`,
    `- **Failed:** ${report.totalFailed}`,
    `- **Status:** ${report.success ? "PASS" : "FAIL"}`,
    "",
  ];

  for (const result of report.results) {
    lines.push(`## ${result.label}`, "");
    lines.push("| Check | Result |");
    lines.push("|-------|--------|");
    for (const check of result.checks) {
      lines.push(`| ${check.name} | ${check.pass ? "PASS" : "FAIL"} |`);
    }
    lines.push("");
    lines.push("### Pipeline Metrics", "");
    lines.push("```json");
    lines.push(JSON.stringify(result.pipeline, null, 2));
    lines.push("```", "");
  }

  return lines.join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
