#!/usr/bin/env node
/**
 * Campaign Facts Layer validation.
 * Run: node scripts/validate-campaign-facts.mjs
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
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
    expected: {
      brandName: "BabyJoy",
      budgetAmount: 2_000_000,
      currency: "EGP",
      durationWeeks: 6,
      geographyIncludes: "Egypt",
      objectiveIncludes: "Awareness",
    },
  },
  {
    id: "cocacola",
    label: "Coca-Cola",
    brandName: "Coca-Cola",
    rawMessage:
      "Strategize a Coca-Cola summer engagement campaign targeting Gen Z. Budget $500,000 across Instagram and TikTok for 8 weeks.",
    expected: {
      brandName: "Coca-Cola",
      budgetAmount: 500_000,
      currency: "USD",
      durationWeeks: 8,
      platformsInclude: ["Instagram", "TikTok"],
    },
  },
  {
    id: "pepsi",
    label: "Pepsi",
    brandName: "Pepsi",
    rawMessage:
      "Create a Pepsi youth activation campaign in UAE. Budget AED 1,200,000 for 10 weeks. Objective: brand awareness on TikTok and Instagram.",
    expected: {
      brandName: "Pepsi",
      budgetAmount: 1_200_000,
      currency: "AED",
      durationWeeks: 10,
      geographyIncludes: "UAE",
    },
  },
  {
    id: "tourism",
    label: "Visit Egypt Tourism",
    brandName: "Visit Egypt",
    rawMessage:
      "Plan a Visit Egypt destination marketing campaign. Budget USD 750,000 over 12 weeks targeting international travelers on Instagram, TikTok, and YouTube.",
    expected: {
      brandName: "Visit Egypt",
      budgetAmount: 750_000,
      currency: "USD",
      durationWeeks: 12,
      platformsInclude: ["Instagram", "TikTok", "YouTube"],
    },
  },
];

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const {
    extractCampaignFacts,
    validateCampaignFacts,
    formatCampaignFactsForSpecialist,
    runCampaignDirectorPipeline,
    writeStrategyDocumentFromBrief,
    buildDirectorBudgetFromStrategy,
  } = await import("../features/campaign-director/index.ts");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalPassed = 0;
  let totalFailed = 0;
  const results = [];

  console.log("\n========== CAMPAIGN FACTS LAYER VALIDATION ==========\n");

  for (const fixture of FIXTURES) {
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

    const rawFacts = extractCampaignFacts({
      rawMessage: fixture.rawMessage,
      brandName: fixture.brandName,
    });
    const facts = validateCampaignFacts(rawFacts);

    check("Facts extracted with timestamp", Boolean(facts.extractedAt));
    check("Brand matches expected", facts.brandName === fixture.expected.brandName, facts.brandName);

    if (fixture.expected.budgetAmount) {
      check(
        "Budget amount matches",
        facts.budget?.amount === fixture.expected.budgetAmount,
        `got ${facts.budget?.amount}`
      );
    }
    if (fixture.expected.currency) {
      check(
        "Currency matches",
        facts.budget?.currency === fixture.expected.currency,
        facts.budget?.currency
      );
    }
    if (fixture.expected.durationWeeks) {
      check(
        "Duration weeks matches",
        facts.durationWeeks === fixture.expected.durationWeeks,
        `got ${facts.durationWeeks}`
      );
    }
    if (fixture.expected.geographyIncludes) {
      check(
        "Geography includes expected region",
        facts.geography?.some((g) =>
          g.toLowerCase().includes(fixture.expected.geographyIncludes.toLowerCase())
        ),
        JSON.stringify(facts.geography)
      );
    }
    if (fixture.expected.objectiveIncludes) {
      check(
        "Objective includes expected phrase",
        facts.objective?.toLowerCase().includes(fixture.expected.objectiveIncludes.toLowerCase()),
        facts.objective
      );
    }
    if (fixture.expected.platformsInclude) {
      const missing = fixture.expected.platformsInclude.filter(
        (p) => !facts.platforms?.includes(p)
      );
      check("Platforms include expected channels", missing.length === 0, missing.join(", "));
    }

    check(
      "Facts block is structured JSON (not prose)",
      formatCampaignFactsForSpecialist(facts).includes('"budget"') &&
        formatCampaignFactsForSpecialist(facts).includes("CAMPAIGN_FACTS_SSOT")
    );

    const strategy = writeStrategyDocumentFromBrief(
      { rawMessage: fixture.rawMessage, brandName: fixture.brandName, campaignFacts: facts },
      facts
    );

    check("Strategy references factsRef", Boolean(strategy.factsRef?.extractedAt));
    check(
      "Strategy budget matches facts",
      strategy.understanding.budget?.amount === facts.budget?.amount &&
        strategy.understanding.budget?.currency === facts.budget?.currency
    );
    check(
      "Strategy duration matches facts",
      strategy.understanding.timeline?.durationWeeks === facts.durationWeeks
    );

    const budget = buildDirectorBudgetFromStrategy(strategy, fixture.rawMessage, facts);
    check(
      "Budget section currency matches facts",
      budget.currency === facts.budget?.currency,
      budget.currency
    );
    check(
      "Budget section total matches facts",
      budget.total === facts.budget?.amount,
      String(budget.total)
    );

    const mockTaskResults = {
      "analyze-request": { taskId: "analyze-request", status: "completed", content: "", agentId: "general" },
      "build-strategy": { taskId: "build-strategy", status: "completed", content: strategy.narrative, agentId: "strategist" },
      "estimate-budget": { taskId: "estimate-budget", status: "completed", content: "Budget ok", agentId: "analyst" },
      "generate-timeline": { taskId: "generate-timeline", status: "completed", content: "Week 1: Campaign Start", agentId: "planner" },
      "prepare-approval": { taskId: "prepare-approval", status: "completed", content: "Ready", agentId: "strategist" },
    };

    const pipeline = runCampaignDirectorPipeline({
      brief: { rawMessage: fixture.rawMessage, brandName: fixture.brandName, campaignFacts: facts },
      taskResults: mockTaskResults,
      campaignFacts: facts,
    });

    const summarySection = pipeline.approvedSections.find((s) => s.sectionKey === "summary");
    const summaryText = typeof summarySection?.content === "string" ? summarySection.content : "";

    if (facts.budget?.currency && facts.budget?.amount) {
      check(
        "Summary section uses facts budget (no contradiction)",
        summaryText.includes(facts.budget.currency) &&
          summaryText.includes(facts.budget.amount.toLocaleString()),
        summaryText.slice(0, 120)
      );
    }

    const timelineSection = pipeline.approvedSections.find((s) => s.sectionKey === "timeline");
    const timelineWeeks =
      timelineSection && typeof timelineSection.content === "object"
        ? timelineSection.content.durationWeeks
        : undefined;
    check(
      "Timeline section uses facts duration",
      timelineWeeks === facts.durationWeeks,
      String(timelineWeeks)
    );

    results.push({ fixture: fixture.id, label: fixture.label, checks, facts: { brandName: facts.brandName, budget: facts.budget, durationWeeks: facts.durationWeeks } });
    console.log("");
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalPassed,
    totalFailed,
    success: totalFailed === 0,
    results,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "campaign-facts-validation-results.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("========== SUMMARY ==========");
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);

  if (totalFailed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
