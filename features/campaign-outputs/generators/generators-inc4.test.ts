import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "../output-test-fixture";
import { generateCampaignOutput, listCampaignOutputs } from "../output-registry";
import { generateKpiForecast } from "./kpi-forecast";
import { generateRiskPlan } from "./risk-plan";
import { generateAmplificationPlan } from "./amplification-plan";
import { generateBudgetAllocation } from "./budget-allocation";
import { generateCreatorActivation } from "./creator-activation";
import { generateContentCalendar } from "./content-calendar";
import { generateInternalOperations } from "./internal-operations";
import { generateExecutiveProposal } from "./executive-proposal";
import { parseKpiTargets, recommendServices } from "./generator-utils";

const PRIORITY = [
  "kpi_forecast",
  "risk_plan",
  "amplification_plan",
  "budget_allocation",
  "creator_activation",
  "content_calendar",
  "internal_operations",
  "executive_proposal",
] as const;

test("all Increment 4 priority outputs are wired and generatable via the registry", () => {
  const views = listCampaignOutputs(buildCampaignObjectFixture());
  for (const kind of PRIORITY) {
    assert.equal(views.find((v) => v.kind === kind)?.generatable, true, kind);
    const { record } = generateCampaignOutput(buildCampaignObjectFixture(), kind);
    assert.equal(record.status, "generated", kind);
    assert.ok(record.content && record.content.sections.length > 0, kind);
    assert.ok(record.generatorVersion, kind);
  }
});

test("KPI Forecast projects outcomes from budget and measures targets", () => {
  const content = generateKpiForecast(buildCampaignObjectFixture());
  const headings = content.sections.map((s) => s.heading);
  assert.ok(headings.includes("Projected Outcomes"));
  assert.ok(headings.includes("Targets vs Projection"));
  const data = content.data as { totalReach: number; targets: unknown[] };
  assert.ok(data.totalReach > 0);
  assert.ok(Array.isArray(data.targets) && data.targets.length > 0);
});

test("KPI Forecast does not project reach without a budget", () => {
  const content = generateKpiForecast(buildCampaignObjectFixture({ facts: { budget: undefined } }));
  const data = content.data as { totalReach: number };
  assert.equal(data.totalReach, 0);
});

test("Risk Assessment flags slate concentration and always provides mitigations", () => {
  const content = generateRiskPlan(
    buildCampaignObjectFixture({
      creators: [
        { id: "a", name: "A", tier: "Macro" },
        { id: "b", name: "B", tier: "Macro" },
        { id: "c", name: "C", tier: "Macro" },
      ],
    })
  );
  const register = content.sections.find((s) => s.heading === "Risk Register")!;
  assert.ok(register.table);
  assert.ok(register.table!.rows.some((r) => /overlap|dominate/i.test(r[0]!)));
  assert.ok(register.table!.rows.every((r) => r[3] && r[3].length > 0));
});

test("Amplification Plan recommends paid products on top-tier creators", () => {
  const content = generateAmplificationPlan(buildCampaignObjectFixture());
  const targets = content.sections.find((s) => s.heading === "Boost Targets")!;
  assert.ok(targets.table);
  assert.ok(targets.table!.rows.some((r) => /Spark Ads|Boosted|Whitelisting/i.test(r[2]! + r[3]!)));
});

test("Budget Allocation defaults to 100% creator fees without brief split keywords", () => {
  const content = generateBudgetAllocation(buildCampaignObjectFixture());
  const data = content.data as {
    total: number;
    creatorFeesTotal: number;
    paid: number;
    contingency: number;
  };
  assert.equal(data.paid, 0);
  assert.equal(data.contingency, 0);
  assert.equal(data.creatorFeesTotal, data.total);
  assert.ok(content.sections.some((s) => s.heading === "Creator Fee Allocation"));
});

test("Creator Activation recommends a service type per creator, leads first", () => {
  const content = generateCreatorActivation(buildCampaignObjectFixture());
  const table = content.sections.find((s) => s.heading === "Creator Roles & Services")!.table!;
  // Celebrity leads the ordering.
  assert.equal(table.rows[0]![1], "Nour Star");
  assert.ok(table.rows.every((r) => r[4] && r[4].length > 0));
});

test("Content Calendar schedules pieces per week with a content mix", () => {
  const content = generateContentCalendar(buildCampaignObjectFixture({ facts: { durationWeeks: 4 } }));
  const weekSections = content.sections.filter((s) => s.heading.startsWith("Week "));
  assert.equal(weekSections.length, 4);
  assert.ok(content.sections.some((s) => s.heading === "Content Mix"));
});

test("Internal Operations Plan covers production, approvals, and reporting", () => {
  const content = generateInternalOperations(buildCampaignObjectFixture());
  const headings = content.sections.map((s) => s.heading);
  for (const h of ["Production Workflow", "Approvals & QA", "Reporting Cadence", "Deliverables Tracking"]) {
    assert.ok(headings.includes(h), h);
  }
});

test("Executive Proposal assembles a client narrative without inventing a budget", () => {
  const withBudget = generateExecutiveProposal(buildCampaignObjectFixture());
  assert.ok(withBudget.sections.some((s) => s.heading === "Investment"));
  const noBudget = generateExecutiveProposal(buildCampaignObjectFixture({ facts: { budget: undefined } }));
  assert.ok(!noBudget.sections.some((s) => s.heading === "Investment"));
  assert.ok(noBudget.sections.some((s) => s.heading === "Creator Lineup"));
});

test("service recommendation maps tier + platform to concrete agency services", () => {
  assert.ok(recommendServices("Celebrity", "TikTok").includes("TikTok Reel"));
  assert.ok(recommendServices("Celebrity", "TikTok").includes("Spark Ads"));
  assert.ok(recommendServices("Nano", "Instagram").includes("UGC"));
});

test("KPI target parsing handles magnitudes and percentages", () => {
  const [reach, er] = parseKpiTargets(["10M reach", "4% engagement"]);
  assert.equal(reach!.value, 10_000_000);
  assert.equal(reach!.metric, "reach");
  assert.equal(er!.value, 4);
  assert.equal(er!.isPercent, true);
});
