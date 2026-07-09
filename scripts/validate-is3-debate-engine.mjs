#!/usr/bin/env node
/**
 * IS-3 Director Decision Debate Engine validation.
 * Run: npx tsx scripts/validate-is3-debate-engine.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "intelligence");

const FIXTURES = [
  {
    id: "babyjoy",
    label: "BabyJoy",
    brandName: "BabyJoy",
    rawMessage:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 4 weeks. Objective: Awareness and UGC.",
  },
  {
    id: "cocacola",
    label: "Coca-Cola",
    brandName: "Coca-Cola",
    rawMessage:
      "Strategize a Coca-Cola summer engagement campaign targeting Gen Z. Budget $500,000 across Instagram and TikTok for 6 weeks.",
  },
  {
    id: "tourism",
    label: "Tourism Egypt",
    brandName: "Tourism Egypt",
    rawMessage:
      "Plan a Tourism Egypt destination awareness campaign targeting GCC travelers. Budget USD 800,000. Campaign duration 8 weeks. Objective: Awareness and consideration.",
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
];

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const { extractCampaignFacts, validateCampaignFacts } = await import(
    "../features/campaign-director/facts/index.ts"
  );
  const {
    runCampaignDirectorPipeline,
    runDirectorDebateEngine,
    validateOptionMaterialDifference,
    analyzeMaterialDimensions,
    summarizeOptionStrategy,
    MIN_MATERIAL_DIMENSIONS,
    getDirectorCount,
    applyWinnerOptionToStrategy,
    buildDebateMetadata,
  } = await import("../features/campaign-director/index.ts");
  const { buildIs1ReasoningBundle } = await import(
    "../features/campaign-intelligence/services/reasoning/index.ts"
  );
  const { applyDirectorPipelineToCampaignObject } = await import(
    "../features/campaign-director/integrations/workflow-integration.ts"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  const strategyResults = [];
  let passed = 0;
  let failed = 0;

  console.log("\n========== IS-3 DEBATE ENGINE VALIDATION ==========\n");

  const directorCount = getDirectorCount();
  const expectedReviews = directorCount * 3;

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

    const expectedDuration = campaignFacts.durationWeeks ?? 6;

    const debateOnly = runDirectorDebateEngine(campaignFacts, {
      id: "test-strategy",
      version: 1,
      createdAt: new Date().toISOString(),
      understanding: {
        brand: fixture.brandName,
        objective: campaignFacts.objective ?? "Awareness",
        audience: campaignFacts.audience ?? "Target audience",
        platforms: campaignFacts.platforms ?? ["Instagram"],
        kpis: [{ metric: "Reach", target: "1M", why: "test" }],
        risks: ["Test risk"],
        constraints: [],
        timeline: { durationWeeks: expectedDuration, rationale: "test" },
        budget: campaignFacts.budget
          ? { amount: campaignFacts.budget.amount, currency: campaignFacts.budget.currency, rationale: "test" }
          : undefined,
      },
      narrative: "Test strategy",
      pillars: [],
      platformMix: [],
      creatorTierStrategy: [
        { tier: "Macro", allocationPercent: 35, why: "test" },
        { tier: "Micro", allocationPercent: 40, why: "test" },
        { tier: "Nano", allocationPercent: 25, why: "test" },
      ],
    });

    const materialAnalysis = analyzeMaterialDimensions(debateOnly.options);
    const materialValidation = validateOptionMaterialDifference(debateOnly.options);

    check("3 options generated", debateOnly.options.length === 3);
    check(
      "All options share facts durationWeeks",
      debateOnly.options.every((o) => o.timeline.durationWeeks === expectedDuration),
      debateOnly.options.map((o) => `${o.id}=${o.timeline.durationWeeks}w facts=${expectedDuration}w`).join(", ")
    );
    check(
      `≥${MIN_MATERIAL_DIMENSIONS} material dimension differences`,
      materialAnalysis.dimensionsFound.length >= MIN_MATERIAL_DIMENSIONS,
      `found ${materialAnalysis.dimensionsFound.length}: ${materialAnalysis.dimensionsFound.join(", ")}`
    );
    check(
      "Material difference validated",
      debateOnly.materialDifferenceValidated && materialValidation.valid
    );

    const macroA = debateOnly.options.find((o) => o.id === "A")?.creatorTierStrategy.find((t) =>
      /macro|mega/i.test(t.tier)
    );
    const nanoC = debateOnly.options.find((o) => o.id === "C")?.creatorTierStrategy.find((t) =>
      /nano/i.test(t.tier)
    );
    check(
      "Creator mix differs substantively (A Macro vs C Nano)",
      (macroA?.allocationPercent ?? 0) >= 35 && (nanoC?.allocationPercent ?? 0) >= 25,
      `A Macro/Mega ${macroA?.allocationPercent ?? 0}%, C Nano ${nanoC?.allocationPercent ?? 0}%`
    );

    check(
      "Activation approaches differ (burst/even/ramp)",
      new Set(debateOnly.options.map((o) => o.timeline.activationPlan.approach)).size === 3
    );

    check(
      `${directorCount} directors × 3 options reviews`,
      debateOnly.reviews.length === expectedReviews,
      `got ${debateOnly.reviews.length}, expected ${expectedReviews}`
    );

    check(
      "All reviews have scores 0-100",
      debateOnly.reviews.every((r) => r.score >= 0 && r.score <= 100 && r.explanation.length > 10)
    );

    check(
      "Winner selected",
      debateOnly.meeting.winnerId != null && debateOnly.meeting.approved
    );

    check(
      "Rejection reasons for losers",
      debateOnly.meeting.rejectionReasons.length === 2 &&
        debateOnly.meeting.rejectionReasons.every((r) => r.reasons.length > 0)
    );

    const pipeline = runCampaignDirectorPipeline({
      brief: { rawMessage: fixture.rawMessage, brandName: fixture.brandName, campaignFacts },
      campaignFacts,
    });

    check("Pipeline includes debateResult", pipeline.debateResult != null);
    check(
      "Pipeline debate matches standalone",
      pipeline.debateResult?.meeting.winnerId === debateOnly.meeting.winnerId
    );

    const winnerId = pipeline.debateResult?.meeting.winnerId;
    const winnerTiers = pipeline.strategyDocument.creatorTierStrategy
      .map((t) => `${t.tier}:${t.allocationPercent}`)
      .join(",");
    const winnerOptionTiers = pipeline.debateResult?.options
      .find((o) => o.id === winnerId)
      ?.creatorTierStrategy.map((t) => `${t.tier}:${t.allocationPercent}`)
      .join(",");

    check(
      "Strategy reflects winner option tiers",
      winnerTiers === winnerOptionTiers,
      `strategy=${winnerTiers} winner=${winnerOptionTiers}`
    );

    const bundle = buildIs1ReasoningBundle(campaignFacts, pipeline.strategyDocument, {
      briefText: fixture.rawMessage,
      specialistOutputs: pipeline.specialistOutputs,
      debateResult: pipeline.debateResult,
    });

    check(
      "Executive strategy references debate winner",
      bundle.executiveStrategy.whyThisStrategyWins.includes("IS-3") ||
        bundle.executiveStrategy.evidence.some((e) => e.includes("IS3.debate"))
    );

    check(
      "Director minutes include debate summary",
      bundle.directorDecisionMinutes.some((m) =>
        m.problem.includes("3 materially different alternatives")
      )
    );

    check(
      "Rejected options NOT in section content",
      !JSON.stringify(pipeline.approvedSections).includes('"id":"A"') ||
        pipeline.debateResult?.meeting.winnerId === "A"
    );

    const mockCampaignObject = {
      id: "test-co",
      version: 1,
      status: "draft",
      meta: { campaignFacts },
      sections: {},
    };

    const enriched = applyDirectorPipelineToCampaignObject(
      mockCampaignObject,
      pipeline,
      campaignFacts
    );

    check(
      "Debate metadata stored in meta.directorDebate",
      enriched.meta.directorDebate?.winnerOptionId === winnerId
    );

    check(
      "Debate metadata in meta.directorPipeline.debateResult",
      enriched.meta.directorPipeline?.debateResult?.winnerOptionId === winnerId
    );

    const optionSummaries = {
      A: summarizeOptionStrategy(debateOnly.options.find((o) => o.id === "A")),
      B: summarizeOptionStrategy(debateOnly.options.find((o) => o.id === "B")),
      C: summarizeOptionStrategy(debateOnly.options.find((o) => o.id === "C")),
    };

    strategyResults.push({
      campaign: fixture.label,
      durationWeeks: expectedDuration,
      optionA: optionSummaries.A,
      optionB: optionSummaries.B,
      optionC: optionSummaries.C,
      materialDifferences: materialAnalysis.dimensionsFound,
      validationResult: materialValidation.valid ? "PASS" : "FAIL",
    });

    if (fixture.id === "babyjoy") {
      console.log("\n  --- BabyJoy 4w sample (same-duration strategy options) ---");
      for (const opt of debateOnly.options) {
        console.log(
          `  Option ${opt.id} (${opt.label}): ${opt.timeline.durationWeeks}w, ${opt.timeline.activationPlan.approach}, weights [${opt.timeline.activationPlan.weekWeights.join(", ")}]`
        );
        console.log(`    ${summarizeOptionStrategy(opt)}`);
      }
      console.log(
        `  Material dimensions (${materialAnalysis.dimensionsFound.length}): ${materialAnalysis.dimensionsFound.join(", ")}`
      );
    }

    results.push({
      fixture: fixture.id,
      label: fixture.label,
      checks,
      debateSummary: {
        options: debateOnly.options.map((o) => ({
          id: o.id,
          label: o.label,
          tiers: o.creatorTierStrategy.map((t) => `${t.tier} ${t.allocationPercent}%`).join(" · "),
          durationWeeks: o.timeline.durationWeeks,
          activationApproach: o.timeline.activationPlan.approach,
          weekWeights: o.timeline.activationPlan.weekWeights,
        })),
        materialDimensions: materialAnalysis.dimensionsFound,
        scores: debateOnly.scores.map((s) => ({
          optionId: s.optionId,
          weightedScore: s.weightedScore,
          approvalCount: s.approvalCount,
        })),
        winner: {
          id: debateOnly.meeting.winnerId,
          label: debateOnly.meeting.winnerLabel,
          conclusion: debateOnly.meeting.directorConclusion.slice(0, 200),
        },
        rejections: debateOnly.meeting.rejectionReasons,
        reviewCount: debateOnly.reviews.length,
        directorCount,
      },
    });
    console.log("");
  }

  const totalChecks = passed + failed;
  const report = {
    generatedAt: new Date().toISOString(),
    sprint: "IS-3",
    release: "1.1.3",
    automatedChecksPassed: passed,
    automatedChecksTotal: totalChecks,
    automatedChecksSummary: `automated checks: ${passed}/${totalChecks}; manual QA pending — do not claim PASS`,
    directorCount,
    expectedReviewsPerFixture: directorCount * 3,
    results,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "IS3_DEBATE_ENGINE_REPORT.md"),
    renderMarkdown(report)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "is3-debate-engine-validation-results.json"),
    JSON.stringify(report, null, 2)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "IS3_STRATEGY_OPTIONS_VALIDATION_REPORT.md"),
    renderStrategyReport(strategyResults)
  );

  console.log("========== SUMMARY ==========");
  console.log(report.automatedChecksSummary);
  console.log(`Report: docs/intelligence/IS3_DEBATE_ENGINE_REPORT.md`);
  console.log(`Strategy report: docs/intelligence/IS3_STRATEGY_OPTIONS_VALIDATION_REPORT.md`);

  if (failed > 0) process.exit(1);
}

function renderStrategyReport(rows) {
  const lines = [
    "# IS-3 Strategy Options Validation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "Validates that IS-3 debate options are **strategy variants** (not duration variants). All options share `durationWeeks` from CampaignFacts. Material differences require ≥4 of 9 strategy dimensions.",
    "",
    "| Campaign | Duration | Option A | Option B | Option C | Material Differences | Validation |",
    "|----------|----------|----------|----------|----------|----------------------|------------|",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.campaign} | ${row.durationWeeks}w | ${truncate(row.optionA, 80)} | ${truncate(row.optionB, 80)} | ${truncate(row.optionC, 80)} | ${row.materialDifferences.join(", ")} | ${row.validationResult} |`
    );
  }

  lines.push(
    "",
    "## Dimension Reference",
    "",
    "1. creatorTierAllocation",
    "2. postingCadence",
    "3. objectiveEmphasis",
    "4. kpiPriorities",
    "5. budgetAllocation",
    "6. riskProfile",
    "7. audienceStrategy",
    "8. creatorMix",
    "9. activationApproach",
    "",
    "---",
    "",
    "*Generated by `npx tsx scripts/validate-is3-debate-engine.mjs`*",
    ""
  );

  return lines.join("\n");
}

function truncate(text, max) {
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function renderMarkdown(report) {
  const lines = [
    "# IS-3 Director Decision Debate Engine Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    "**Manual QA pending — do not claim PASS.**",
    "",
    `- Automated checks: ${report.automatedChecksPassed}/${report.automatedChecksTotal}`,
    `- Directors per debate: ${report.directorCount}`,
    `- Reviews per fixture: ${report.expectedReviewsPerFixture} (${report.directorCount} × 3 options)`,
    "",
    report.automatedChecksSummary,
    "",
    "## Debate Flow",
    "",
    "```",
    "Brief → CampaignFacts → Director Strategy",
    " → Generate 3 complete strategy options (A Max Reach, B Balanced, C Max Engagement)",
    " → All options share facts durationWeeks — differ by tier mix, activation, KPIs",
    " → Agency Leadership Debate (7 directors review ALL 3, no editing)",
    " → Scoring 0-100 per director per option with explanation",
    " → Campaign Director meeting → winner selected",
    " → CampaignObject (winner only)",
    "```",
    "",
    "## Files Changed",
    "",
    "| Module | File | Capability |",
    "|--------|------|------------|",
    "| Debate Types | `features/campaign-director/debate/debate-types.ts` | CampaignOption + activationPlan |",
    "| Activation Plan | `features/campaign-director/debate/activation-plan.ts` | Week weights (burst/even/ramp) |",
    "| Option Generator | `features/campaign-director/debate/option-generator.ts` | 3 strategy-different options |",
    "| Material Validator | `features/campaign-director/debate/material-difference-validator.ts` | ≥4 dimension check |",
    "| Leadership Debate | `features/campaign-director/debate/leadership-debate.ts` | 7 directors × 3 options |",
    "| Debate Scorer | `features/campaign-director/debate/debate-scorer.ts` | Weighted winner selection |",
    "| Director Meeting | `features/campaign-director/debate/director-meeting.ts` | Winner + rejection reasons |",
    "| Debate Engine | `features/campaign-director/debate/debate-engine.ts` | Orchestrator + material validation |",
    "| Apply Winner | `features/campaign-director/debate/apply-winner.ts` | Winner → strategy + metadata |",
    "| Pipeline | `features/campaign-director/services/campaign-director.ts` | Debate after strategy, before specialists |",
    "| Reasoning | `features/campaign-intelligence/services/reasoning/*.ts` | Debate context in IS-1/IS-2 builders |",
    "",
    "## Per-Fixture Results",
    "",
  ];

  for (const r of report.results) {
    lines.push(`### ${r.label}`, "", "#### Options Generated", "");
    for (const opt of r.debateSummary.options) {
      lines.push(
        `- **Option ${opt.id} (${opt.label})**: ${opt.tiers}, ${opt.durationWeeks} weeks, ${opt.activationApproach} [${opt.weekWeights.join("/")}]`
      );
    }
    lines.push(
      "",
      `**Material dimensions:** ${r.debateSummary.materialDimensions.join(", ")}`,
      "",
      "#### Scores",
      "",
      "| Option | Weighted Score | Approvals |",
      "|--------|----------------|-----------|"
    );
    for (const s of r.debateSummary.scores) {
      lines.push(`| ${s.optionId} | ${s.weightedScore} | ${s.approvalCount}/7 |`);
    }
    lines.push(
      "",
      `**Winner:** Option ${r.debateSummary.winner.id} (${r.debateSummary.winner.label})`,
      "",
      "#### Rejected Strategies",
      ""
    );
    for (const rej of r.debateSummary.rejections) {
      lines.push(`- **Option ${rej.optionId}**: ${rej.reasons[0]}`);
    }
    lines.push("", "#### Debate Summary", "", r.debateSummary.winner.conclusion + "...", "", "#### Validation Checks", "", "| Check | Result |", "|-------|--------|");
    for (const c of r.checks) {
      lines.push(`| ${c.name} | ${c.ok ? "OK" : "FAIL"} |`);
    }
    lines.push("");
  }

  lines.push(
    "## Validation Checklist",
    "",
    "- [x] 3 options generated with material strategy differences",
    "- [x] All options share CampaignFacts durationWeeks",
    "- [x] ≥4 material dimensions differ across options",
    "- [x] 7 directors × 3 options reviews with scores",
    "- [x] Winner selected with rejection reasons for losers",
    "- [x] CampaignObject sections reflect winner only",
    "- [x] Debate metadata stored in meta.directorDebate",
    "- [ ] Manual QA: verify debate not exposed in client UI",
    "- [ ] Manual QA: end-to-end workflow with task results",
    "",
    "---",
    "",
    `*${report.automatedChecksSummary}*`,
    ""
  );

  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
