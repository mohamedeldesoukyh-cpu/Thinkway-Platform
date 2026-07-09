#!/usr/bin/env node
/**
 * Campaign Facts Migration validation (Release 1.1.1).
 * Run: npx tsx scripts/validate-campaign-facts-migration.mjs
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
    clientName: "BabyJoy",
    rawMessage:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
    expected: {
      brandName: "BabyJoy",
      clientName: "BabyJoy",
      budgetAmount: 2_000_000,
      currency: "EGP",
      durationWeeks: 6,
      objectiveIncludes: "Awareness",
      kpiCountMin: 0,
    },
  },
  {
    id: "cocacola",
    label: "Coca-Cola",
    brandName: "Coca-Cola",
    clientName: "The Coca-Cola Company",
    rawMessage:
      "Strategize a Coca-Cola summer engagement campaign targeting Gen Z. Budget $500,000 across Instagram and TikTok for 8 weeks.",
    expected: {
      brandName: "Coca-Cola",
      budgetAmount: 500_000,
      currency: "USD",
      durationWeeks: 8,
      kpiCountMin: 0,
    },
  },
];

function createCampaignObjectWithFacts(facts, rawMessage) {
  const now = new Date().toISOString();
  return {
    id: `test-${facts.brandName?.toLowerCase().replace(/\s+/g, "-") ?? "campaign"}`,
    updatedAt: now,
    sections: {
      summary: {
        content: `Brand: ${facts.brandName}\nBudget: ${facts.budget?.amount} ${facts.budget?.currency}\nDuration: ${facts.durationWeeks} weeks\nObjective: ${facts.objective ?? "Awareness"}`,
        status: "complete",
      },
      audience: { content: facts.audience ?? "Target audience from brief", status: "complete" },
      strategy: {
        content: "Strategy narrative with conflicting budget USD 999 and duration 4 weeks.",
        status: "complete",
      },
      creators: { content: "", status: "pending" },
      budget: {
        content: "Total budget USD 999,000 — LLM estimate contradicts facts.",
        status: "complete",
      },
      timeline: {
        content: "Week 1: Start\nWeek 2: Production\nWeek 3: Publish\nWeek 4: Report",
        status: "complete",
      },
      performance: { content: "", status: "pending" },
      presentation: { content: "", status: "pending" },
      operations: { content: "", status: "pending" },
    },
    meta: {
      status: "building",
      specialistProgress: [],
      campaignFacts: facts,
      workflowStatus: "running",
    },
  };
}

function createLegacyCampaignObject(rawMessage) {
  const now = new Date().toISOString();
  return {
    id: "test-legacy",
    updatedAt: now,
    sections: {
      summary: {
        content: rawMessage,
        status: "complete",
      },
      audience: { content: "Parents aged 25-40", status: "complete" },
      strategy: { content: "Build awareness through creator content.", status: "complete" },
      creators: { content: "", status: "pending" },
      budget: {
        content: "Total budget EGP 2,000,000 allocated across creator fees.",
        status: "complete",
      },
      timeline: { content: "6 week campaign timeline.", status: "complete" },
      performance: { content: "", status: "pending" },
      presentation: { content: "", status: "pending" },
      operations: { content: "", status: "pending" },
    },
    meta: {
      status: "building",
      specialistProgress: [],
    },
  };
}

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const { extractCampaignFacts, validateCampaignFacts } = await import(
    "../features/campaign-director/facts/index.ts"
  );
  const { enrichCampaignObjectWithStudioData } = await import(
    "../features/campaign-intelligence/services/studio-section-data-builders.ts"
  );
  const {
    resolveBudgetData,
    resolveCampaignSummary,
    resolveGroundedKpis,
    resolveCreatorMix,
    resolveTimelineData,
    resolvePresentationData,
    resolveCampaignObjectCurrency,
  } = await import("../features/campaign-studio/services/section-data-resolver.ts");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalPassed = 0;
  let totalFailed = 0;
  const results = [];

  console.log("\n========== CAMPAIGN FACTS MIGRATION VALIDATION ==========\n");
  console.log("Note: manual QA pending on new Coca-Cola + BabyJoy campaigns.\n");

  for (const fixture of FIXTURES) {
    console.log(`--- ${fixture.label} (${fixture.id}) — with campaignFacts ---`);
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

    const rawFacts = extractCampaignFacts({
      rawMessage: fixture.rawMessage,
      brandName: fixture.brandName,
      clientName: fixture.clientName,
    });
    const facts = validateCampaignFacts(rawFacts);
    const campaignObject = createCampaignObjectWithFacts(facts, fixture.rawMessage);
    const enriched = enrichCampaignObjectWithStudioData(campaignObject);

    const summary = resolveCampaignSummary(enriched);
    const budget = resolveBudgetData(enriched);
    const currency = resolveCampaignObjectCurrency(enriched);
    const timeline = resolveTimelineData(enriched);
    const kpis = resolveGroundedKpis(enriched);
    const creatorMix = resolveCreatorMix(enriched);
    const presentation = resolvePresentationData(enriched);

    check("Summary brand from facts", summary?.brand === fixture.expected.brandName, summary?.brand);
    if (fixture.expected.clientName) {
      check(
        "Summary client from facts",
        summary?.client === fixture.expected.clientName ||
          summary?.client === fixture.expected.brandName,
        summary?.client
      );
    }
    check(
      "Budget total from facts (not LLM text)",
      budget?.total === fixture.expected.budgetAmount,
      String(budget?.total)
    );
    check(
      "Currency from facts (not LLM text)",
      currency === fixture.expected.currency,
      currency
    );
    check(
      "Timeline duration from facts",
      timeline?.durationWeeks === fixture.expected.durationWeeks,
      String(timeline?.durationWeeks)
    );
    if (fixture.expected.objectiveIncludes) {
      check(
        "Objective from facts",
        summary?.objective?.toLowerCase().includes(fixture.expected.objectiveIncludes.toLowerCase()),
        summary?.objective
      );
    }
    check(
      "Creator mix tiers populated from facts",
      creatorMix.length >= 2,
      String(creatorMix.length)
    );
    check(
      "Presentation brand from facts",
      presentation?.brandName === fixture.expected.brandName,
      presentation?.brandName
    );
    check(
      "Enriched budget section content matches facts currency",
      enriched.sections.budget.content?.currency === fixture.expected.currency,
      enriched.sections.budget.content?.currency
    );
    check(
      "Enriched timeline durationWeeks matches facts",
      enriched.sections.timeline.content?.durationWeeks === fixture.expected.durationWeeks,
      String(enriched.sections.timeline.content?.durationWeeks)
    );

    results.push({ fixture: fixture.id, label: fixture.label, checks });
    console.log("");
  }

  console.log("--- Legacy campaign WITHOUT campaignFacts ---");
  const legacyChecks = [];
  function legacyCheck(name, condition, detail) {
    const pass = Boolean(condition);
    legacyChecks.push({ name, pass, detail });
    if (pass) {
      totalPassed++;
      console.log(`  ✓ ${name}`);
    } else {
      totalFailed++;
      console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    }
  }

  const legacyObject = createLegacyCampaignObject(
    "Launch BabyJoy Premium Diapers in Egypt. Budget EGP 2,000,000. Campaign duration 6 weeks."
  );
  let legacyEnriched;
  let legacyError = null;
  try {
    legacyEnriched = enrichCampaignObjectWithStudioData(legacyObject);
    legacyCheck("Legacy enrich completes without crash", true);
    legacyCheck(
      "Legacy budget resolves via fallback",
      resolveBudgetData(legacyEnriched) != null || resolveCampaignSummary(legacyEnriched) != null,
      "no data"
    );
    legacyCheck(
      "Legacy summary has brand or client",
      Boolean(resolveCampaignSummary(legacyEnriched)?.brand || resolveCampaignSummary(legacyEnriched)?.client),
      JSON.stringify(resolveCampaignSummary(legacyEnriched))
    );
  } catch (error) {
    legacyError = error instanceof Error ? error.message : String(error);
    legacyCheck("Legacy enrich completes without crash", false, legacyError);
  }

  results.push({ fixture: "legacy-no-facts", label: "Legacy (no facts)", checks: legacyChecks });

  const report = {
    generatedAt: new Date().toISOString(),
    release: "1.1.1",
    totalPassed,
    totalFailed,
    automatedValidation: `${totalPassed}/${totalPassed + totalFailed}`,
    manualQaStatus: "pending — Coca-Cola + BabyJoy campaigns",
    success: totalFailed === 0,
    results,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "campaign-facts-migration-validation-results.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\n========== SUMMARY ==========");
  console.log(`Automated validation: ${totalPassed}/${totalPassed + totalFailed}`);
  console.log("Manual QA: pending — Coca-Cola + BabyJoy campaigns");
  console.log(`Failed: ${totalFailed}`);

  if (totalFailed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
