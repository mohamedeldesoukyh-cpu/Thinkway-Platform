/**
 * Sprint 8.8 — Fast presentation-layer validation (no browser).
 * Verifies industry detection and derived section differentiation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "sprint-8.8");

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

async function main() {
  const { detectIndustryFromBrief, getIndustryKpis, getIndustryProfile, getIndustryRisks } =
    await import("../features/campaign-studio/services/industry-intelligence.ts");
  const {
    deriveCreativeConcepts,
    deriveCreatorMix,
    deriveWhyAiInsights,
  } = await import("../features/campaign-studio/services/presentation-intelligence.ts");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const outputs = {};
  for (const [id, brief] of Object.entries(BRIEFS)) {
    const industry = detectIndustryFromBrief(brief);
    const profile = getIndustryProfile(industry, brief);
    const kpis = getIndustryKpis(industry, brief);
    const risks = getIndustryRisks(industry);
    const concepts = deriveCreativeConcepts(brief, brief);
    const mix = deriveCreatorMix(brief, brief);
    const whyAi = deriveWhyAiInsights(brief, brief, brief);

    outputs[id] = {
      industry,
      campaignType: profile.campaignType,
      kpiMetrics: kpis.map((k) => k.metric),
      riskTitles: risks.map((r) => r.risk),
      conceptNames: concepts.map((c) => c.name),
      creatorMix: mix.map((m) => `${m.tier}:${m.percent}%`),
      whyAiCategories: whyAi.map((w) => w.category),
    };
  }

  const industries = new Set(Object.values(outputs).map((o) => o.industry));
  const kpiSets = Object.values(outputs).map((o) => o.kpiMetrics.join("|"));
  const conceptSets = Object.values(outputs).map((o) => o.conceptNames.join("|"));

  const report = {
    timestamp: new Date().toISOString(),
    industriesDetected: [...industries],
    uniqueIndustries: industries.size,
    uniqueKpiSets: new Set(kpiSets).size,
    uniqueConceptSets: new Set(conceptSets).size,
    allIndustriesDifferent: industries.size >= 5,
    outputs,
  };

  fs.writeFileSync(path.join(OUT_DIR, "industry-validation.json"), JSON.stringify(report, null, 2));

  console.log("Industry validation complete:");
  console.log(`  Unique industries: ${report.uniqueIndustries}/5`);
  console.log(`  Unique KPI sets: ${report.uniqueKpiSets}/5`);
  console.log(`  Unique concept sets: ${report.uniqueConceptSets}/5`);
  console.log(`  Output: ${path.join(OUT_DIR, "industry-validation.json")}`);

  if (report.uniqueIndustries < 5 || report.uniqueKpiSets < 5) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
