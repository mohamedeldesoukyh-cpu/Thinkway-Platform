import assert from "node:assert/strict";

import {
  deriveInfluencerBudgetAllocations,
  normalizeBudgetAllocationPercents,
  resolveBudgetAllocations,
  sumAllocationPercents,
} from "./budget-allocation";

function testBabyJoyParsedBudgetTotals100(): void {
  const parsed = [
    { category: "Creator fees", amount: 1_240_000 },
    { category: "Content production", amount: 360_000 },
    { category: "Contingency reserve", percent: 10 },
  ];
  const normalized = resolveBudgetAllocations(
    parsed,
    "Launch BabyJoy Premium Diapers in Egypt. Budget EGP 2,000,000.",
    2_000_000
  );
  assert.equal(sumAllocationPercents(normalized), 100, "BabyJoy parsed budget sums to 100%");
}

function testIndustryProfilesTotal100(): void {
  for (const context of [
    "BabyJoy diapers Egypt",
    "Coca-Cola summer Gen Z engagement",
    "Adidas sportswear launch",
    "Visit Egypt tourism",
    "Emirates NBD credit card",
    "Rolex luxury campaign",
  ]) {
    const lines = deriveInfluencerBudgetAllocations(
      context.includes("BabyJoy")
        ? "baby"
        : context.includes("Coca-Cola") || context.includes("Adidas")
          ? "retail"
          : context.includes("Visit")
            ? "tourism"
            : context.includes("Emirates")
              ? "finance"
              : context.includes("Rolex")
                ? "luxury"
                : "general",
      context,
      1_000_000
    );
    assert.equal(sumAllocationPercents(lines), 100, `${context} profile totals 100%`);
  }
}

function testNormalizePartialPercents(): void {
  const normalized = normalizeBudgetAllocationPercents(
    [
      { category: "Creator fees", percent: 62 },
      { category: "Content production", percent: 18 },
      { category: "Contingency reserve", percent: 10 },
    ],
    2_000_000
  );
  assert.equal(sumAllocationPercents(normalized), 100);
}

function run(): void {
  testBabyJoyParsedBudgetTotals100();
  testIndustryProfilesTotal100();
  testNormalizePartialPercents();
  console.log("budget-allocation.test.ts: PASS");
}

run();
