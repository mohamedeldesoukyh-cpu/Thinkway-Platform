/**
 * Sprint 8.9 — Grounding validation (no browser).
 * Verifies every recommendation has source, confidence, and differentiation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "sprint-8.9");

const BRIEFS = {
  "babyjoy-egypt":
    "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
  "rolex-middle-east":
    "Launch Rolex luxury watch collection across UAE and Saudi Arabia. Target affluent professionals 35–55. Budget AED 5,000,000. Duration 8 weeks. Objective: Brand prestige and aspiration.",
  "visit-egypt-tourism":
    "Visit Egypt tourism campaign promoting ancient wonders and Red Sea adventures. Target adventure travelers 25–40 across MENA. Budget USD 3,500,000. Duration 12 weeks.",
  "adidas-egypt":
    "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo. Budget EGP 4,500,000. Duration 6 weeks.",
  "emirates-nbd":
    "Emirates NBD credit card product adoption campaign in UAE. Target young professionals 25–35. Budget AED 2,800,000. Duration 8 weeks.",
};

function assertGrounding(label, items, requiredFields) {
  const missing = [];
  for (const item of items) {
    for (const field of requiredFields) {
      if (item[field] == null || item[field] === "") missing.push(`${label}.${field}`);
    }
  }
  return missing;
}

async function main() {
  const { detectIndustryFromBrief } = await import(
    "../features/campaign-studio/services/industry-intelligence.ts"
  );
  const {
    deriveCreativeConcepts,
    deriveExecutiveSummary,
    deriveOpportunities,
    deriveSuccessProbability,
    deriveGroundedStrategy,
    deriveWhyAiInsights,
  } = await import("../features/campaign-studio/services/presentation-intelligence.ts");
  const {
    resolveBudgetData,
    resolveGroundedKpis,
    resolveGroundedStrategyFields,
    resolveIndustryBenchmark,
    resolveExecutiveSummaryData,
    resolveSuccessProbability,
    resolveOpportunities,
    resolveContentPlan,
  } = await import("../features/campaign-studio/services/section-data-resolver.ts");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const outputs = {};
  const errors = [];

  for (const [id, brief] of Object.entries(BRIEFS)) {
    const industry = detectIndustryFromBrief(brief);
    const strategy = deriveGroundedStrategy(brief, brief, brief);
    const budget = resolveBudgetData(undefined, brief);
    const kpis = resolveGroundedKpis(undefined, brief);
    const benchmark = resolveIndustryBenchmark(undefined, brief);
    const success = resolveSuccessProbability(undefined, brief);
    const opportunities = resolveOpportunities(undefined, brief);
    const executive = resolveExecutiveSummaryData(undefined, brief);
    const concepts = deriveCreativeConcepts(brief, brief);
    const contentPlan = resolveContentPlan(undefined, brief);
    const whyAi = deriveWhyAiInsights(brief, brief, brief);

    const groundingChecks = [
      ...strategy.flatMap((s) =>
        !s.grounding?.source || s.grounding.confidence == null || !s.grounding.reason
          ? [`strategy.${s.label}`]
          : []
      ),
      ...assertGrounding("budget", budget?.groundedAllocations ?? [], ["reason", "source", "confidence"]),
      ...assertGrounding("kpis", kpis, ["confidence", "reason", "calculationSource"]),
      ...assertGrounding("whyAi", whyAi, ["evidence", "source", "confidence"]),
    ];

    if (groundingChecks.length) errors.push({ id, missing: groundingChecks });

    outputs[id] = {
      industry,
      strategyFields: strategy.map((s) => `${s.label}:${s.grounding.source}:${s.grounding.confidence}%`),
      budgetReasons: budget?.groundedAllocations?.map((a) => `${a.category}:${a.percent}%`),
      kpiMetrics: kpis.map((k) => k.metric),
      kpiConfidences: kpis.map((k) => k.confidence),
      conceptNames: concepts.map((c) => c.name),
      conceptEmotions: concepts.map((c) => c.targetEmotion),
      contentDeliverables: contentPlan.map((c) => `${c.platform} ${c.quantity} ${c.contentType}`),
      successScore: success.score,
      opportunityTitles: opportunities.map((o) => o.title),
      executiveSummary: executive.summary.slice(0, 80),
      benchmarkEr: benchmark.comparisons.find((c) => c.metric === "Expected ER")?.expected,
    };
  }

  const industries = new Set(Object.values(outputs).map((o) => o.industry));
  const kpiSets = Object.values(outputs).map((o) => o.kpiMetrics.join("|"));
  const conceptSets = Object.values(outputs).map((o) => o.conceptNames.join("|"));
  const successScores = Object.values(outputs).map((o) => o.successScore);
  const execSummaries = Object.values(outputs).map((o) => o.executiveSummary);

  const report = {
    timestamp: new Date().toISOString(),
    sprint: "8.9",
    industriesDetected: [...industries],
    uniqueIndustries: industries.size,
    uniqueKpiSets: new Set(kpiSets).size,
    uniqueConceptSets: new Set(conceptSets).size,
    uniqueSuccessScores: new Set(successScores).size,
    uniqueExecutiveSummaries: new Set(execSummaries).size,
    groundingErrors: errors,
    allGrounded: errors.length === 0,
    outputs,
  };

  fs.writeFileSync(path.join(OUT_DIR, "grounding-validation.json"), JSON.stringify(report, null, 2));

  console.log("Sprint 8.9 grounding validation:");
  console.log(`  Unique industries: ${report.uniqueIndustries}/5`);
  console.log(`  Unique KPI sets: ${report.uniqueKpiSets}/5`);
  console.log(`  Unique concept sets: ${report.uniqueConceptSets}/5`);
  console.log(`  Unique success scores: ${report.uniqueSuccessScores}/5`);
  console.log(`  All grounded: ${report.allGrounded}`);
  console.log(`  Output: ${path.join(OUT_DIR, "grounding-validation.json")}`);

  if (
    report.uniqueIndustries < 5 ||
    report.uniqueKpiSets < 5 ||
    !report.allGrounded
  ) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
