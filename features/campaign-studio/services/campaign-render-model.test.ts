import assert from "node:assert/strict";

import type { CreatorMixTier, GroundedKpi } from "@/features/campaign-intelligence/types/section-schemas";
import {
  buildKpiFramework,
  containsInternalContent,
  estimateSlateReach,
  filterCelebrityMixTiers,
  formatReachValue,
  sanitizeClientBrandLabel,
  sanitizeClientFacingText,
  sanitizeLegacyReachValue,
  stripCelebrityFromLabel,
} from "./campaign-render-model";

function testFormatReachValue() {
  assert.equal(formatReachValue(296_500), "297K");
  assert.equal(formatReachValue(1_240_000), "1.2M");
  assert.equal(formatReachValue(12_400_000), "12M");
  assert.equal(formatReachValue(950), "950");
  console.log("✓ formatReachValue");
}

function testEstimateSlateReachFromSlate() {
  const reach = estimateSlateReach([
    { displayName: "A", platform: "instagram", followers: 800_000 },
    { displayName: "B", platform: "tiktok", followers: 450_000 },
    { displayName: "C", platform: "instagram", followers: 120_000 },
  ]);
  assert.ok(reach, "reach must be computed from slate");
  // Instagram 920K × 0.20–0.35 + TikTok 450K × 0.25–0.50
  assert.equal(reach.low, 296_500);
  assert.equal(reach.high, 547_000);
  assert.equal(reach.formattedRange, "297K–547K estimated reach");
  assert.equal(reach.totalFollowers, 1_370_000);
  assert.equal(reach.creatorCount, 3);
  assert.ok(
    reach.assumptions.some((a) => a.includes("combined follower base of 1.4M")),
    "assumptions must document the follower base"
  );
  assert.ok(
    reach.assumptions.some((a) => /organic per-post reach/i.test(a)),
    "assumptions must document the reach-rate model"
  );
  assert.ok(
    reach.assumptions.some((a) => /paid amplification/i.test(a)),
    "assumptions must state paid boost is excluded"
  );
  console.log("✓ estimateSlateReach computes from slate with documented assumptions");
}

function testEstimateSlateReachPendingWithoutData() {
  assert.equal(estimateSlateReach([]), null);
  assert.equal(estimateSlateReach([{ displayName: "NoData" }]), null);

  const partial = estimateSlateReach([
    { displayName: "A", platform: "instagram", followers: 100_000 },
    { displayName: "B" },
  ]);
  assert.ok(partial);
  assert.equal(partial.excludedCreatorCount, 1);
  assert.ok(partial.assumptions.some((a) => /without verified follower data/i.test(a)));
  console.log("✓ estimateSlateReach returns null / documents exclusions without data");
}

function testSanitizeLegacyReachValue() {
  assert.equal(sanitizeLegacyReachValue("2.5M–4M qualified impressions"), undefined);
  assert.equal(sanitizeLegacyReachValue("8M–15M campaign impressions"), undefined);
  assert.equal(sanitizeLegacyReachValue("3M–6M parents reached"), undefined);
  assert.equal(sanitizeLegacyReachValue("2M–5M estimated reach"), undefined);
  assert.equal(sanitizeLegacyReachValue("1.2M"), "1.2M");
  assert.equal(sanitizeLegacyReachValue(undefined), undefined);
  console.log("✓ sanitizeLegacyReachValue drops template ranges, keeps computed values");
}

function testCelebrityMixFilter() {
  const tiers: CreatorMixTier[] = [
    { tier: "Celebrity", count: 1, percent: 15, reasoning: "Ambassador" },
    { tier: "Macro", count: 2, percent: 35, reasoning: "Reach" },
    { tier: "Mid", count: 3, percent: 30, reasoning: "Lifestyle" },
    { tier: "Micro", count: 2, percent: 20, reasoning: "Niche" },
  ];

  const gated = filterCelebrityMixTiers(tiers, false);
  assert.ok(gated.every((t) => t.tier !== "Celebrity"), "Celebrity tier must be removed");
  assert.equal(
    gated.reduce((sum, t) => sum + t.percent, 0),
    100,
    "percentages must renormalize to 100"
  );

  const allowed = filterCelebrityMixTiers(tiers, true);
  assert.ok(allowed.some((t) => t.tier === "Celebrity"), "Celebrity kept when allowed");

  assert.equal(stripCelebrityFromLabel("Macro + Celebrity · editorial quality", false), "Macro · editorial quality");
  assert.equal(stripCelebrityFromLabel("Macro + Celebrity", true), "Macro + Celebrity");
  console.log("✓ celebrity gating filters mix tiers and labels");
}

function testSanitizeClientFacingText() {
  assert.equal(
    sanitizeClientFacingText("Strong target. TBD — confirm with brand objectives."),
    "Strong target."
  );
  assert.equal(sanitizeClientFacingText("Verification required"), "");
  assert.equal(
    sanitizeClientFacingText("Extracted from CampaignFacts SSOT. Supports awareness."),
    "Supports awareness."
  );
  assert.equal(
    sanitizeClientFacingText("Reach-only KPI — rejected; trial needs UGC proof."),
    ""
  );
  assert.ok(containsInternalContent("Based on 47 historical campaigns"));
  assert.ok(!containsInternalContent("Drive awareness across Instagram and TikTok"));
  console.log("✓ sanitizeClientFacingText strips internal reasoning");
}

function testSanitizeClientBrandLabel() {
  assert.equal(sanitizeClientBrandLabel("Brand Client"), undefined);
  assert.equal(sanitizeClientBrandLabel("Campaign"), undefined);
  assert.equal(sanitizeClientBrandLabel("  "), undefined);
  assert.equal(sanitizeClientBrandLabel("Nile Fresh"), "Nile Fresh");
  console.log("✓ sanitizeClientBrandLabel rejects placeholder brands");
}

function testBuildKpiFramework() {
  const kpis: GroundedKpi[] = [
    {
      metric: "Engagement rate",
      prediction: "5%+ blended",
      confidence: 85,
      reason: "Extracted from campaign facts SSOT",
      calculationSource: "CampaignFacts.kpis",
      platform: "instagram",
    },
    {
      metric: "UGC volume",
      prediction: "Per brief",
      confidence: 80,
      reason: "Supports trial through peer proof at scale.",
      calculationSource: "Industry benchmark",
    },
  ];

  const rows = buildKpiFramework(kpis);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].metric, "Engagement rate");
  assert.equal(rows[0].target, "5%+ blended");
  assert.equal(
    rows[0].rationale,
    "Supports the campaign objective and creator strategy.",
    "internal SSOT reason must be replaced with client-safe rationale"
  );
  assert.ok(rows[0].measurement.includes("Instagram analytics"));
  assert.equal(rows[1].target, "As agreed in the campaign brief");
  assert.equal(rows[1].rationale, "Supports trial through peer proof at scale.");
  for (const row of rows) {
    for (const value of Object.values(row)) {
      assert.ok(!containsInternalContent(value), `internal content leaked: ${value}`);
    }
  }
  console.log("✓ buildKpiFramework produces client-safe rows");
}

testFormatReachValue();
testEstimateSlateReachFromSlate();
testEstimateSlateReachPendingWithoutData();
testSanitizeLegacyReachValue();
testCelebrityMixFilter();
testSanitizeClientFacingText();
testSanitizeClientBrandLabel();
testBuildKpiFramework();

console.log("\nAll campaign-render-model tests passed.");
