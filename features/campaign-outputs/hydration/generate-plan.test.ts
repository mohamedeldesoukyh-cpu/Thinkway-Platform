import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { QuotationDetail } from "@/lib/domains/commercial/quotation-detail-types";

import { planGenerateFromSource } from "./generate-plan";
import { seedFromQuotation } from "./seed-adapters";

function quotationFixture(): QuotationDetail {
  return {
    id: "q1",
    name: "Q",
    client_name: "Acme",
    brand_name: "Acme",
    total_revenue_egp: 2_000_000,
    estimated_reach: 8_000_000,
    estimated_engagement_rate: 4,
    items: [
      {
        id: "i1",
        unified_id: "cr_1",
        creator_name: "Nour",
        platform: "Instagram",
        followers: 1_500_000,
        engagement_rate: 3,
        country_code: "EG",
        creator_categories: ["beauty"],
        deliverables: [],
        service_description: "2 Reels",
      },
    ],
  } as unknown as QuotationDetail;
}

test("plan hydrates a quotation and lists ready outputs + missing inputs", () => {
  const plan = planGenerateFromSource(seedFromQuotation(quotationFixture()));
  // Budget Allocation needs budget/creators/platforms — all present in a quote.
  assert.ok(plan.readyKinds.includes("budget_allocation"));
  // Media Plan needs a timeline, which a quotation doesn't carry → not ready.
  assert.ok(!plan.readyKinds.includes("media_plan"));
  const mediaReadiness = plan.readiness.find((r) => r.kind === "media_plan");
  assert.ok(mediaReadiness?.missingInputs.includes("Timeline"));
  // The plan surfaces the missing campaign inputs to ask for.
  assert.ok(plan.result.missing.missingLabels.includes("Campaign objective"));
});
