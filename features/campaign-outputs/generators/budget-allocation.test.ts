import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { generateBudgetAllocation } from "./budget-allocation";
import { buildCampaignObjectFixture } from "../output-test-fixture";

test("uses quotation line fees when present on the slate", () => {
  const creatorsData: CreatorsSectionData = {
    recommendations: {
      creatorIds: ["c1", "c2"],
      selectedReasoning: [
        {
          creatorId: "c1",
          displayName: "Creator A",
          expectedRole: "Macro",
          platform: "instagram",
          quotedRevenue: 50_000,
          quotedCurrency: "EGP",
          whySelected: "fit",
          audienceMatch: "m",
          risk: "low",
          alternative: "n/a",
          confidence: 0.8,
          evidence: "e",
          tradeoff: "t",
        },
        {
          creatorId: "c2",
          displayName: "Creator B",
          expectedRole: "Micro",
          platform: "tiktok",
          quotedRevenue: 30_000,
          quotedCurrency: "EGP",
          whySelected: "fit",
          audienceMatch: "m",
          risk: "low",
          alternative: "n/a",
          confidence: 0.8,
          evidence: "e",
          tradeoff: "t",
        },
      ],
    },
  };

  const obj = buildCampaignObjectFixture({
    facts: { budget: { amount: 80_000, currency: "EGP" } },
    creators: [
      { id: "c1", name: "Creator A", tier: "Macro" },
      { id: "c2", name: "Creator B", tier: "Micro" },
    ],
  });
  obj.sections.creators.data = creatorsData as unknown as Record<string, unknown>;

  const content = generateBudgetAllocation(obj);
  const data = content.data as { creatorFeesTotal: number; quotedFromCommercial: boolean };
  assert.equal(data.creatorFeesTotal, 80_000);
  assert.equal(data.quotedFromCommercial, true);

  const table = content.sections.find((s) => s.heading === "Creator Fee Allocation")!.table!;
  assert.equal(table.rows[0]![3], "50,000 EGP");
  assert.equal(table.rows[1]![3], "30,000 EGP");
  assert.ok(!content.summary?.includes("paid amplification"));
});
