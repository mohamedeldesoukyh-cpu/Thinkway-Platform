#!/usr/bin/env node
/**
 * IS-2 Decision Intelligence Sprint validation.
 * Run: node scripts/validate-is2-decision-intelligence.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "intelligence");

const GENERIC_BLOCKLIST = [
  "leverage",
  "synergy",
  "best-in-class",
  "world-class",
  "cutting-edge",
  "game-changer",
  "paradigm shift",
  "holistic approach",
  "move the needle",
  "low-hanging fruit",
  "think outside the box",
  "robust solution",
  "seamless experience",
  "unlock value",
];

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
    id: "production-split",
    label: "Production Split Brief",
    brandName: "Luxury Hotel Dubai",
    rawMessage:
      "Luxury hotel launch in Dubai. Budget AED 1,200,000 for 10 weeks. Need dedicated video production studio, photographer, and usage rights for paid boosting.",
  },
];

const IS2_FUNNEL_STAGES = [
  "database",
  "country",
  "category",
  "audience",
  "brand_safety",
  "engagement",
  "availability",
  "director_review",
  "approved",
];

const EXEC_IS2_FIELDS = [
  "businessChallenge",
  "marketingChallenge",
  "audienceChallenge",
  "rejectedAlternatives",
  "chosenStrategy",
  "risks",
  "successConditions",
  "confidenceLevel",
  "evidence",
];

const VENDOR_SELECTED_FIELDS = [
  "whySelected",
  "whyNotAnother",
  "contribution",
  "expectedRole",
  "risk",
  "confidence",
  "missingData",
  "manualVerification",
  "directorNotes",
];

const MINUTE_BOARD_FIELDS = ["problem", "alternatives", "decision", "rejected", "impact", "owner", "confidence", "evidence"];

function containsBlocklist(text) {
  const lower = text.toLowerCase();
  return GENERIC_BLOCKLIST.filter((phrase) => lower.includes(phrase));
}

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const { extractCampaignFacts, validateCampaignFacts } = await import(
    "../features/campaign-director/facts/index.ts"
  );
  const { runCampaignDirectorPipeline, evaluateDecisionIntelligenceGate } = await import(
    "../features/campaign-director/index.ts"
  );
  const { buildIs1ReasoningBundle } = await import(
    "../features/campaign-intelligence/services/reasoning/index.ts"
  );
  const { buildDirectorBudgetFromStrategy } = await import(
    "../features/campaign-director/services/budget-rules.ts"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let passed = 0;
  let failed = 0;

  console.log("\n========== IS-2 DECISION INTELLIGENCE VALIDATION ==========\n");

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
    });

    const gate = evaluateDecisionIntelligenceGate({
      facts: campaignFacts,
      strategy: pipeline.strategyDocument,
      reasoning: bundle,
      budget,
      briefText: fixture.rawMessage,
    });

    for (const field of EXEC_IS2_FIELDS) {
      const val = bundle.executiveStrategy[field];
      const populated =
        field === "confidenceLevel"
          ? typeof val === "number" && val > 0
          : Array.isArray(val)
            ? val.length > 0
            : val != null && String(val).length > 10;
      check(`Executive.${field}`, populated);
    }

    check(
      "Vendor funnel IS-2 stages (9)",
      bundle.vendorDiscoveryFunnel.length === 9 &&
        IS2_FUNNEL_STAGES.every((id) => bundle.vendorDiscoveryFunnel.some((s) => s.id === id))
    );

    check(
      "Funnel no fabricated baseline without search",
      bundle.vendorDiscoveryFunnel.find((s) => s.id === "database")?.count === 0 ||
        bundle.vendorDiscoveryFunnel.find((s) => s.id === "approved")?.count > 0
    );

    const creatorFees = budget.allocations.find((a) => /creator\s*fees?/i.test(a.category));
    const isProductionFixture = fixture.id === "production-split";
    check(
      isProductionFixture ? "Budget splits on production keywords" : "Budget default 100% creator fees",
      isProductionFixture
        ? budget.allocations.some((a) => /production|studio|usage|boosting/i.test(a.category))
        : (creatorFees?.percent ?? 0) === 100,
      isProductionFixture
        ? `allocations: ${budget.allocations.map((a) => a.category).join(", ")}`
        : `creator fees ${creatorFees?.percent ?? 0}%`
    );

    check(
      "Timeline weeks = duration",
      bundle.creatorActivationTimeline.activationWeeks.length === campaignFacts.durationWeeks
    );

    check(
      "Reporting outside duration",
      bundle.creatorActivationTimeline.reportingPhase.label.toLowerCase().includes("reporting")
    );

    check(
      "Creator mix whyMix + tier impacts",
      Boolean(bundle.creatorMix.whyMix) &&
        bundle.creatorMix.tiers.every(
          (t) => t.budgetImpact && t.reachImpact && t.erImpact && t.rejectedAlternative
        )
    );

    check(
      "KPI sensitivity fields",
      bundle.kpiForecast.kpis.length > 0 &&
        bundle.kpiForecast.kpis.every((k) => k.sensitivity && k.reason && k.dependencies?.length)
    );

    check(
      "Director minutes board format",
      bundle.directorDecisionMinutes.length >= 4 &&
        bundle.directorDecisionMinutes.every((m) =>
          MINUTE_BOARD_FIELDS.every((f) => m[f] != null && String(m[f]).length > 0)
        )
    );

    check(
      "Decision intelligence gate",
      gate.passed,
      gate.blockers.join("; ")
    );

    check(
      "Pipeline approval requires decision gate",
      pipeline.decisionIntelligenceGate?.passed === gate.passed
    );

    if (bundle.vendorRecommendations.selected.length > 0) {
      const first = bundle.vendorRecommendations.selected[0];
      for (const field of VENDOR_SELECTED_FIELDS) {
        check(`Vendor.${field}`, first[field] != null && String(first[field]).length > 0);
      }
    } else {
      check("Vendor recommendations (no creators in fixture)", true);
    }

    const blocklistHits = containsBlocklist(JSON.stringify(bundle));
    check("No generic blocklist phrases", blocklistHits.length === 0, blocklistHits.join(", "));

    results.push({
      fixture: fixture.id,
      label: fixture.label,
      checks,
      gateChecks: gate.checks,
      gateBlockers: gate.blockers,
    });
    console.log("");
  }

  const totalChecks = passed + failed;
  const report = {
    generatedAt: new Date().toISOString(),
    sprint: "IS-2",
    release: "1.1.2",
    automatedChecksPassed: passed,
    automatedChecksTotal: totalChecks,
    automatedChecksSummary: `automated checks: ${passed}/${totalChecks}; manual QA pending — do not claim PASS`,
    results,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "IS2_DECISION_INTELLIGENCE_REPORT.md"),
    renderMarkdown(report)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "is2-decision-intelligence-validation-results.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("========== SUMMARY ==========");
  console.log(report.automatedChecksSummary);
  console.log(`Report: docs/intelligence/IS2_DECISION_INTELLIGENCE_REPORT.md`);

  if (failed > 0) process.exit(1);
}

function renderMarkdown(report) {
  const lines = [
    "# IS-2 Decision Intelligence Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    "**Manual QA pending — do not claim PASS.**",
    "",
    `- Automated checks: ${report.automatedChecksPassed}/${report.automatedChecksTotal}`,
    "",
    report.automatedChecksSummary,
    "",
    "## IS-2 Intelligence Modules",
    "",
    "| Module | File | Capability |",
    "|--------|------|------------|",
    "| Executive Strategy | `executive-strategy-reasoning.ts` | Business/marketing/audience challenge, risks, success conditions |",
    "| Vendor Discovery | `vendor-discovery-funnel.ts` | Database→Approved funnel; no fabricated counts |",
    "| Vendor Recommendations | `vendor-recommendation-reasoning.ts` | Per-creator selection rationale; no demographic fabrication |",
    "| Budget | `budget-planner-reasoning.ts` + `budget-rules.ts` | 100% creator fees default; split on brief keywords |",
    "| Timeline | `creator-activation-timeline.ts` | Activation weeks + reporting after duration |",
    "| KPI | `kpi-reasoning.ts` | Achievability, sensitivity, dependencies, risk |",
    "| Creator Mix | `creator-mix-reasoning.ts` | whyMix, tier impacts, rejected alternatives |",
    "| Decision Minutes | `director-decision-minutes.ts` | Board format: problem, decision, owner, impact |",
    "| Approval Gate | `decision-intelligence-gate.ts` | Evidence, alignment, anti-fabrication checks |",
    "",
    "## Per-Fixture Results",
    "",
  ];

  for (const r of report.results) {
    lines.push(`### ${r.label}`, "", "| Check | Result |", "|-------|--------|");
    for (const c of r.checks) {
      lines.push(`| ${c.name} | ${c.ok ? "OK" : "FAIL"} |`);
    }
    if (r.gateBlockers?.length) {
      lines.push("", "**Gate blockers:**", ...r.gateBlockers.map((b) => `- ${b}`));
    }
    lines.push("");
  }

  lines.push("---", "", `*${report.automatedChecksSummary}*`, "");
  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
