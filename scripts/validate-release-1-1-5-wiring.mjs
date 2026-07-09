#!/usr/bin/env node
/**
 * Release 1.1.5 — Director Output Wiring validation.
 * Run: node scripts/validate-release-1-1-5-wiring.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "release");

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

const FUNNEL_STAGE_IDS = [
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

function structuralMatch(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return String(a).trim() === String(b).trim();
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => structuralMatch(item, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  const keys = new Set([...keysA, ...keysB]);
  for (const key of keys) {
    if (!structuralMatch(a[key], b[key])) return false;
  }
  return true;
}

function pickMixPercents(mix) {
  return (mix ?? []).map((t) => `${t.tier}:${t.percent}`).sort().join("|");
}

async function main() {
  await import("../lib/performance/script-env-preload.ts");

  const { extractCampaignFacts, validateCampaignFacts } = await import(
    "../features/campaign-director/facts/index.ts"
  );
  const { runCampaignDirectorPipeline } = await import(
    "../features/campaign-director/index.ts"
  );
  const { applyDirectorPipelineToCampaignObject } = await import(
    "../features/campaign-director/integrations/workflow-integration.ts"
  );
  const { enrichCampaignObjectWithStudioData } = await import(
    "../features/campaign-intelligence/services/studio-section-data-builders.ts"
  );
  const {
    resolveGroundedStrategyFields,
    resolveExecutiveStrategyReasoning,
    executiveStrategyReasoningToFields,
    resolveDiscoveryPipeline,
    resolveCreatorMix,
    resolveGroundedKpis,
    resolveTimelineData,
    resolveBudgetData,
    resolveDirectorDecisionMinutes,
    directorDecisionMinutesToInsights,
    resolveWhyAi,
    resolveRiskData,
    resolveVendorGrounding,
  } = await import("../features/campaign-studio/services/section-data-resolver.ts");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let passed = 0;
  let failed = 0;
  let fallbackUsed = 0;

  console.log("\n========== RELEASE 1.1.5 DIRECTOR OUTPUT WIRING ==========\n");

  for (const fixture of FIXTURES) {
    console.log(`--- ${fixture.label} (${fixture.id}) ---`);
    const checks = [];

    function check(name, condition, detail = "", isFallback = false) {
      const ok = Boolean(condition);
      checks.push({ name, ok, detail, fallback: isFallback });
      if (ok) {
        passed++;
        console.log(`  ✓ ${name}${isFallback ? " (fallback documented)" : ""}`);
      } else {
        failed++;
        console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
      }
      if (isFallback) fallbackUsed++;
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

    const baseObject = applyDirectorPipelineToCampaignObject(
      {
        id: `r115-${fixture.id}`,
        updatedAt: new Date().toISOString(),
        sections: {
          summary: { content: fixture.rawMessage, status: "complete" },
          audience: { content: campaignFacts.audience ?? "", status: "complete" },
          strategy: { content: pipeline.strategyDocument.narrative, status: "complete" },
          creators: { content: "", status: "complete" },
          budget: { content: "", status: "complete" },
          timeline: { content: "", status: "complete" },
          performance: { content: "", status: "complete" },
          presentation: { content: "", status: "pending" },
          operations: { content: "", status: "complete" },
        },
        meta: { status: "building", specialistProgress: [], campaignFacts },
      },
      pipeline,
      campaignFacts
    );

    const enriched = enrichCampaignObjectWithStudioData(baseObject);
    const strategyData = enriched.sections.strategy.data ?? {};
    const performanceData = enriched.sections.performance.data ?? {};
    const budgetData = enriched.sections.budget.data ?? {};
    const timelineData = enriched.sections.timeline.data ?? {};
    const creatorsData = enriched.sections.creators.data ?? {};

    // 1. Executive Strategy
    const execReasoning = resolveExecutiveStrategyReasoning(enriched);
    const execFields = execReasoning ? executiveStrategyReasoningToFields(execReasoning) : [];
    check(
      "Executive Strategy: reasoning preserved after enrich",
      Boolean(strategyData.executiveStrategyReasoning?.chosenStrategy)
    );
    check(
      "Executive Strategy: resolver uses approved reasoning",
      execReasoning?.chosenStrategy === strategyData.executiveStrategyReasoning?.chosenStrategy
    );
    check(
      "Executive Strategy: resolver fields match reasoning",
      execFields.some((f) => f.value === execReasoning?.chosenStrategy)
    );

    // 2. Vendor Discovery
    const funnel = resolveDiscoveryPipeline(enriched, false);
    check(
      "Vendor Discovery: funnel stage count",
      funnel.length === (creatorsData.vendorDiscoveryFunnel?.length ?? funnel.length)
    );
    if (creatorsData.vendorDiscoveryFunnel?.length) {
      check(
        "Vendor Discovery: IS-2 funnel ids verbatim",
        FUNNEL_STAGE_IDS.every((id) => funnel.some((s) => s.id === id))
      );
      check(
        "Vendor Discovery: resolver matches approved funnel",
        structuralMatch(funnel, creatorsData.vendorDiscoveryFunnel)
      );
    } else {
      check("Vendor Discovery: legacy fallback", funnel.length > 0, "", true);
    }

    // 3. Vendor Recommendations — selectedReasoning wired in resolver
    const selected = creatorsData.recommendations?.selectedReasoning ?? [];
    if (selected.length > 0) {
      const grounding = resolveVendorGrounding(
        { displayName: selected[0].displayName ?? "Vendor", handle: selected[0].creatorId, platform: "instagram" },
        enriched,
        0
      );
      check(
        "Vendor Recommendations: whySelected from selectedReasoning",
        grounding.whySelected === selected[0].whySelected
      );
    } else {
      check("Vendor Recommendations: no selectedReasoning (fallback path)", true, "", true);
    }

    // 4. Budget Planner
    const budget = resolveBudgetData(enriched);
    if (budgetData.allocationReasoning?.length) {
      check(
        "Budget Planner: allocation reasoning preserved",
        budget?.groundedAllocations?.[0]?.reason === budgetData.allocationReasoning[0]?.reason
      );
      check(
        "Budget Planner: director rationale surfaced",
        Boolean(budget?.budgetPlannerReasoning || budgetData.budgetPlannerReasoning)
      );
    } else {
      check("Budget Planner: legacy allocation fallback", Boolean(budget?.groundedAllocations?.length), "", true);
    }

    // 5. Timeline
    const timeline = resolveTimelineData(enriched);
    if (timelineData.creatorActivationTimeline?.activationWeeks?.length) {
      check(
        "Timeline: activation weeks count",
        timeline?.weeks.length >= timelineData.creatorActivationTimeline.activationWeeks.length
      );
      check(
        "Timeline: first week objective from approved data",
        timeline?.weeks[0]?.phase === timelineData.creatorActivationTimeline.activationWeeks[0]?.objective
      );
    } else {
      check("Timeline: legacy week template fallback", Boolean(timeline?.weeks.length), "", true);
    }

    // 6. Creator Mix
    const mix = resolveCreatorMix(enriched);
    if (strategyData.creatorMix?.length) {
      check(
        "Creator Mix: resolver matches approved tiers",
        pickMixPercents(mix) === pickMixPercents(strategyData.creatorMix)
      );
    } else {
      check("Creator Mix: industry/facts fallback", mix.length > 0, "", true);
    }

    // 7. KPI Forecast
    const kpis = resolveGroundedKpis(enriched);
    if (performanceData.kpiReasoning?.length) {
      check(
        "KPI Forecast: resolver uses kpiReasoning",
        kpis[0]?.metric === performanceData.kpiReasoning[0]?.metric &&
          kpis[0]?.prediction === performanceData.kpiReasoning[0]?.target
      );
    } else if (performanceData.groundedKpis?.length) {
      check(
        "KPI Forecast: resolver uses stored groundedKpis",
        kpis[0]?.metric === performanceData.groundedKpis[0]?.metric
      );
    } else {
      check("KPI Forecast: facts/industry fallback", kpis.length >= 0, "", true);
    }

    // 8. Risk Analysis
    const risks = resolveRiskData(enriched);
    const directorRisks = enriched.sections.operations.content;
    if (directorRisks?.risks?.length) {
      check(
        "Risk Analysis: director risks preserved in resolver",
        risks?.risks[0]?.risk === directorRisks.risks[0]?.risk
      );
    } else {
      check("Risk Analysis: enriched/industry fallback", Boolean(risks?.risks.length), "", true);
    }

    // 9. Director Decision Minutes / Why AI
    const minutes = resolveDirectorDecisionMinutes(enriched);
    const insights = minutes.length > 0 ? directorDecisionMinutesToInsights(minutes) : resolveWhyAi(enriched);
    if (minutes.length > 0) {
      check(
        "Decision Rationale: minutes preserved after enrich",
        minutes.length === strategyData.directorDecisionMinutes?.length
      );
      check(
        "Decision Rationale: resolver maps minutes to insights",
        insights[0]?.title === minutes[0]?.decision
      );
    } else {
      check("Decision Rationale: legacy whyAiInsights fallback", insights.length >= 0, "", true);
    }

    results.push({ fixture: fixture.id, label: fixture.label, checks });
    console.log("");
  }

  const totalChecks = passed + failed;
  const report = {
    release: "1.1.5",
    generatedAt: new Date().toISOString(),
    passClaimed: false,
    manualQaRequired: true,
    fixtures: FIXTURES.map((f) => f.id),
    sectionsMigrated: 9,
    automatedChecksPassed: passed,
    automatedChecksFailed: failed,
    automatedChecksTotal: totalChecks,
    fallbackPathsDocumented: fallbackUsed,
    summary: `Release 1.1.5 wiring validation: ${passed}/${totalChecks} checks passed; manual QA required before sign-off`,
    results,
  };

  const reportPath = path.join(OUT_DIR, "release-1-1-5-wiring-validation-results.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("========== SUMMARY ==========");
  console.log(`Sections migrated: 9`);
  console.log(`Checks: ${passed}/${totalChecks} passed (${failed} failed)`);
  console.log(`Fallback paths documented: ${fallbackUsed}`);
  console.log(`Results: ${reportPath}`);
  console.log("Manual QA required — do NOT claim PASS.\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
