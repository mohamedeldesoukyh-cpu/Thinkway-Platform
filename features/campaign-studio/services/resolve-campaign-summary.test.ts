import assert from "node:assert/strict";
import test from "node:test";

import { hydrateCampaignObject } from "@/features/campaign-outputs/hydration/hydrate";
import { seedFromQuotation } from "@/features/campaign-outputs/hydration/seed-adapters";
import type { QuotationDetail } from "@/features/quotations/types";

import { resolveCampaignSummary } from "./section-data-resolver";

function quotationFixture(): QuotationDetail {
  return {
    id: "q-1",
    name: "Summer Launch",
    serial_number: "QT-2026-0001",
    status: "approved",
    client_name: "Acme Co",
    brand_name: "Acme Brand",
    total_revenue_egp: 2_000_000,
    estimated_reach: 500_000,
    estimated_engagement_rate: 3.2,
    items: [
      {
        id: "item-1",
        sort_order: 1,
        influencer_id: "inf-1",
        platform: "instagram",
        country_code: "EG",
        deliverables: [{ platform: "instagram", type: "reel", quantity: 2 }],
      },
    ],
  } as QuotationDetail;
}

test("resolveCampaignSummary derives cards from quotation facts when summaryCards are absent", () => {
  const { campaignObject } = hydrateCampaignObject(seedFromQuotation(quotationFixture()));

  assert.equal(campaignObject.sections.summary.data?.summaryCards, undefined);

  const summary = resolveCampaignSummary(campaignObject);

  assert.ok(summary);
  assert.equal(summary?.client, "Acme Co");
  assert.equal(summary?.brand, "Acme Brand");
  assert.match(summary?.budget ?? "", /2,000,000/);
});

console.log("resolve-campaign-summary.test.ts — all tests passed");
