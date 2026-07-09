#!/usr/bin/env node
/**
 * IS-1 Intelligence Sprint validation.
 * Run: node scripts/validate-is1-intelligence.mjs
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
  "best in class",
  "world-class",
  "cutting-edge",
  "game-changer",
  "paradigm shift",
  "holistic approach",
  "move the needle",
  "low-hanging fruit",
  "think outside the box",
  "at the end of the day",
  "robust solution",
  "seamless experience",
  "unlock value",
  "drive synergy",
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
];

const EXEC_FIELDS = [
  "businessChallenge",
  "strategicInsight",
  "rejectedAlternatives",
  "chosenStrategy",
  "whyThisStrategyWins",
  "expectedTradeoffs",
  "confidenceLevel",
  "directorConclusion",
];

const FUNNEL_STAGES = [
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

function containsBlocklist(text) {
  const lower = text.toLowerCase();
  return GENERIC_BLOCKLIST.filter((phrase) => lower.includes(phrase));
}

function substantiveDiff(a, b) {
  if (!a || !b) return false;
  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/babyjoy|baby joy|coca-cola|coca cola|coke/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return false;
  const wordsA = new Set(na.split(" ").filter((w) => w.length > 4));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 4));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  const union = new Set([...wordsA, ...wordsB]).size || 1;
  const jaccard = overlap / union;
  return jaccard < 0.55;
}

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const { extractCampaignFacts, validateCampaignFacts } = await import(
    "../features/campaign-director/facts/index.ts"
  );
  const { runCampaignDirectorPipeline } = await import(
    "../features/campaign-director/index.ts"
  );
  const { buildIs1ReasoningBundle } = await import(
    "../features/campaign-intelligence/services/reasoning/index.ts"
  );
  const { enrichCampaignObjectWithStudioData } = await import(
    "../features/campaign-intelligence/services/studio-section-data-builders.ts"
  );
  const { applyDirectorPipelineToCampaignObject } = await import(
    "../features/campaign-director/integrations/workflow-integration.ts"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let passed = 0;
  let failed = 0;
  const bundles = {};

  console.log("\n========== IS-1 INTELLIGENCE VALIDATION ==========\n");

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

    const bundle = buildIs1ReasoningBundle(campaignFacts, pipeline.strategyDocument, {
      briefText: fixture.rawMessage,
      specialistOutputs: pipeline.specialistOutputs,
    });
    bundles[fixture.id] = bundle;

    for (const field of EXEC_FIELDS) {
      const val = bundle.executiveStrategy[field];
      const populated =
        field === "confidenceLevel"
          ? typeof val === "number" && val > 0
          : Array.isArray(val)
            ? val.length > 0
            : val != null && String(val).length > 10;
      check(`Executive Strategy.${field}`, populated, String(val ?? "").slice(0, 80));
    }

    check(
      "Vendor funnel stages (9)",
      bundle.vendorDiscoveryFunnel.length === 9 &&
        FUNNEL_STAGES.every((id) => bundle.vendorDiscoveryFunnel.some((s) => s.id === id))
    );

    check(
      "Funnel stages have removalWhy",
      bundle.vendorDiscoveryFunnel.every((s) => s.removalWhy && s.removalWhy.length > 15)
    );

    check(
      "Budget allocations have reasoning fields",
      bundle.budgetPlanner.allocations.length > 0 &&
        bundle.budgetPlanner.allocations.every(
          (a) => a.reason && a.evidence && a.tradeoff && a.alternativeConsidered
        )
    );

    check(
      "Creator activation weeks",
      bundle.creatorActivationTimeline.activationWeeks.length === campaignFacts.durationWeeks
    );

    check(
      "Reporting AFTER campaign",
      bundle.creatorActivationTimeline.reportingPhase.label.toLowerCase().includes("reporting")
    );

    check(
      "Creator mix reasoning per tier",
      bundle.creatorMix.tiers.length === pipeline.strategyDocument.creatorTierStrategy.length &&
        bundle.creatorMix.tiers.every((t) => t.whyThisTier && t.ifTierChanged)
    );

    check(
      "KPI reasoning fields",
      bundle.kpiForecast.kpis.length > 0 &&
        bundle.kpiForecast.kpis.every(
          (k) => k.reason && k.dependencies?.length && k.risk && k.tradeoff
        )
    );

    check(
      "Director decision minutes",
      bundle.directorDecisionMinutes.length >= 4 &&
        bundle.directorDecisionMinutes.every(
          (m) => m.decision && m.reason && m.finalApproval && m.alternativesConsidered?.length
        )
    );

    const allText = JSON.stringify(bundle);
    const blocklistHits = containsBlocklist(allText);
    check("No generic blocklist phrases", blocklistHits.length === 0, blocklistHits.join(", "));

    check(
      "References CampaignFacts",
      allText.includes("CampaignFacts") || allText.includes(fixture.brandName)
    );

    const mockObject = applyDirectorPipelineToCampaignObject(
      {
        id: `is1-${fixture.id}`,
        updatedAt: new Date().toISOString(),
        sections: {
          summary: { content: fixture.rawMessage, status: "complete" },
          audience: { content: campaignFacts.audience ?? "", status: "complete" },
          strategy: { content: pipeline.strategyDocument.narrative, status: "complete" },
          creators: { content: "", status: "pending" },
          budget: { content: "", status: "pending" },
          timeline: { content: "", status: "pending" },
          performance: { content: "", status: "pending" },
          presentation: { content: "", status: "pending" },
          operations: { content: "", status: "pending" },
        },
        meta: { status: "building", specialistProgress: [], campaignFacts },
      },
      pipeline,
      campaignFacts
    );

    const enriched = enrichCampaignObjectWithStudioData(mockObject);
    check(
      "Studio enrich: executiveStrategyReasoning",
      Boolean(enriched.sections.strategy.data?.executiveStrategyReasoning?.chosenStrategy)
    );
    check(
      "Studio enrich: directorDecisionMinutes",
      (enriched.sections.strategy.data?.directorDecisionMinutes?.length ?? 0) >= 4
    );

    results.push({ fixture: fixture.id, label: fixture.label, checks });
    console.log("");
  }

  const baby = bundles.babyjoy;
  const coke = bundles.cocacola;

  const uniquenessChecks = [
    {
      name: "Executive chosenStrategy differs",
      ok: substantiveDiff(baby?.executiveStrategy.chosenStrategy, coke?.executiveStrategy.chosenStrategy),
    },
    {
      name: "Business challenge differs",
      ok: substantiveDiff(
        baby?.executiveStrategy.businessChallenge,
        coke?.executiveStrategy.businessChallenge
      ),
    },
    {
      name: "KPI metrics differ",
      ok: substantiveDiff(
        baby?.kpiForecast.kpis.map((k) => k.metric).join(","),
        coke?.kpiForecast.kpis.map((k) => k.metric).join(",")
      ),
    },
    {
      name: "Budget reasoning differs",
      ok: substantiveDiff(
        baby?.budgetPlanner.allocations[0]?.reason,
        coke?.budgetPlanner.allocations[0]?.reason
      ),
    },
  ];

  for (const u of uniquenessChecks) {
    if (u.ok) {
      passed++;
      console.log(`  ✓ Cross-campaign: ${u.name}`);
    } else {
      failed++;
      console.log(`  ✗ Cross-campaign: ${u.name}`);
    }
  }

  const totalChecks = passed + failed;
  const report = {
    generatedAt: new Date().toISOString(),
    sprint: "IS-1",
    automatedChecksPassed: passed,
    automatedChecksTotal: totalChecks,
    automatedChecksSummary: `automated checks: ${passed}/${totalChecks}; manual intelligence review pending`,
    results,
    uniquenessChecks,
    diffSamples: {
      executiveChosenStrategy: {
        babyjoy: baby?.executiveStrategy.chosenStrategy?.slice(0, 200),
        cocacola: coke?.executiveStrategy.chosenStrategy?.slice(0, 200),
      },
      kpiFirstMetric: {
        babyjoy: baby?.kpiForecast.kpis[0],
        cocacola: coke?.kpiForecast.kpis[0],
      },
      directorConclusion: {
        babyjoy: baby?.executiveStrategy.directorConclusion?.slice(0, 200),
        cocacola: coke?.executiveStrategy.directorConclusion?.slice(0, 200),
      },
    },
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "IS1_INTELLIGENCE_REVIEW_REPORT.md"),
    renderMarkdown(report)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "is1-intelligence-validation-results.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("========== SUMMARY ==========");
  console.log(report.automatedChecksSummary);
  console.log(`Report: docs/intelligence/IS1_INTELLIGENCE_REVIEW_REPORT.md`);

  if (failed > 0) process.exit(1);
}

function renderMarkdown(report) {
  const lines = [
    "# IS-1 Intelligence Review Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `**${report.automatedChecksSummary}**`,
    "",
    `- Automated checks: ${report.automatedChecksPassed}/${report.automatedChecksTotal}`,
    "",
    "## Sections Became Campaign-Specific",
    "",
    "| Section | IS-1 Change |",
    "|---------|-------------|",
    "| Executive Strategy | Structured WHY fields (challenge, insight, rejected alternatives, trade-offs) |",
    "| Vendor Discovery | 9-stage funnel with count + removalWhy per stage |",
    "| Vendor Recommendations | Selected/rejected reasoning per creator |",
    "| Budget Planner | Influencer-only allocations with reason/evidence/trade-off |",
    "| Timeline | Creator activation weeks (tier + objective + reason); reporting after duration |",
    "| Creator Mix | whyThisTier + ifTierChanged per tier |",
    "| KPI Forecast | reason, confidence, dependencies, risk, trade-off per KPI |",
    "| Director Decision Minutes | Renamed from Thinkway Decision Rationale (data layer) |",
    "",
    "## Generic Paragraphs Eliminated",
    "",
    "- Blocklist enforced: leverage, synergy, best-in-class, world-class, cutting-edge, etc.",
    "- Specialist dispatch outputs cite CampaignFacts + DirectorStrategy fields",
    "- Executive strategy uses brand/industry/geography-specific rejection rationale",
    "",
    "## Director Reasoning Impact",
    "",
    "- Single Director brain approves all sections via `buildIs1ReasoningBundle`",
    "- `buildApprovedSections` attaches reasoning data to approved section payloads",
    "- `enrichCampaignObjectWithStudioData` merges IS-1 fields into `sections.*.data`",
    "",
    "## BabyJoy vs Coca-Cola Diff Samples",
    "",
    "### Chosen Strategy",
    "",
    "**BabyJoy:**",
    "",
    `> ${report.diffSamples.executiveChosenStrategy.babyjoy}`,
    "",
    "**Coca-Cola:**",
    "",
    `> ${report.diffSamples.executiveChosenStrategy.cocacola}`,
    "",
    "### First KPI Reasoning",
    "",
    "```json",
    JSON.stringify(report.diffSamples.kpiFirstMetric, null, 2),
    "```",
    "",
    "### Director Conclusion",
    "",
    "| Campaign | Conclusion (excerpt) |",
    "|----------|---------------------|",
    `| BabyJoy | ${report.diffSamples.directorConclusion.babyjoy} |`,
    `| Coca-Cola | ${report.diffSamples.directorConclusion.cocacola} |`,
    "",
    "## Per-Fixture Checks",
    "",
  ];

  for (const r of report.results) {
    lines.push(`### ${r.label}`, "", "| Check | Result |", "|-------|--------|");
    for (const c of r.checks) {
      lines.push(`| ${c.name} | ${c.ok ? "OK" : "FAIL"} |`);
    }
    lines.push("");
  }

  lines.push("## Cross-Campaign Uniqueness", "", "| Check | Result |", "|-------|--------|");
  for (const u of report.uniquenessChecks) {
    lines.push(`| ${u.name} | ${u.ok ? "OK" : "FAIL"} |`);
  }
  lines.push("", "---", "", `*${report.automatedChecksSummary}*`, "");

  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
