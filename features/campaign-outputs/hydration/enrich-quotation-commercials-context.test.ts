import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { QuotationDetail } from "@/lib/domains/commercial/quotation-detail-types";

import { seedFromQuotation } from "./seed-adapters";
import { hydrateCampaignObject } from "./hydrate";
import { enrichMediaPlanCampaignContext } from "../generators/media-plan";
import { buildCampaignObjectFixture } from "../output-test-fixture";
import { mergeQuotationCommercialsContext } from "./quotation-commercials-meta";

function dolphinTunaQuotationFixture(): QuotationDetail {
  return {
    id: "q-dolphin",
    name: "Dolphin Tuna Q3",
    status: "draft",
    currency: "EGP",
    total_revenue_egp: 250_000,
    is_temporary_brand: true,
    temporary_brand_name: "Dolphin Tuna",
    brand_name: "Dolphin Tuna",
    brand_id: null,
    group_name: "Food Group",
    agency_or_direct: "agency",
    agency_name: "Media Agency Egypt",
    client_name: "Dolphin Foods LLC",
    items: [
      {
        id: "item-1",
        unified_id: "creator-1",
        creator_name: "Nour Star",
        platform: "Instagram",
        followers: 500_000,
        revenue_egp: 120_000,
        deliverables: [{ type: "ig_reel", type_lines: [{ type: "ig_reel", quantity: 1 }] }],
      },
    ],
  } as unknown as QuotationDetail;
}

test("seedFromQuotation maps group and agency for temporary Dolphin Tuna brand", () => {
  const seed = seedFromQuotation(dolphinTunaQuotationFixture());
  assert.equal(seed.brand, "Dolphin Tuna");
  assert.equal(seed.group, "Food Group");
  assert.equal(seed.agencyOrDirect, "agency");
  assert.equal(seed.agencyName, "Media Agency Egypt");
});

test("hydrateCampaignObject persists group and agency on quotationCommercials meta", () => {
  const seed = seedFromQuotation(dolphinTunaQuotationFixture());
  const { campaignObject } = hydrateCampaignObject(seed, undefined, {
    quotationId: "q-dolphin",
  });

  assert.equal(campaignObject.meta.quotationCommercials?.brandName, "Dolphin Tuna");
  assert.equal(campaignObject.meta.quotationCommercials?.groupName, "Food Group");
  assert.equal(campaignObject.meta.quotationCommercials?.agencyOrDirect, "agency");
  assert.equal(campaignObject.meta.quotationCommercials?.agencyName, "Media Agency Egypt");
});

test("mergeQuotationCommercialsContext fills missing group on stale snapshot", () => {
  const merged = mergeQuotationCommercialsContext(
    {
      syncedAt: "2026-01-01T00:00:00.000Z",
      creators: [],
      brandName: "Dolphin Tuna",
    },
    {
      quotationId: "q-dolphin",
      groupName: "Food Group",
      agencyOrDirect: "agency",
      agencyName: "Media Agency Egypt",
    }
  );

  assert.equal(merged.brandName, "Dolphin Tuna");
  assert.equal(merged.groupName, "Food Group");
  assert.equal(merged.agencyName, "Media Agency Egypt");
});

test("enrichMediaPlanCampaignContext applies live group over cached brand-only context", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.quotationCommercials = {
    syncedAt: new Date().toISOString(),
    creators: [],
    quotationId: "q-dolphin",
    brandName: "Dolphin Tuna",
    groupName: "Food Group",
    agencyOrDirect: "agency",
    agencyName: "Media Agency Egypt",
  };

  const enriched = enrichMediaPlanCampaignContext(
    {
      durationWeeks: 6,
      campaignStartDate: "2026-07-07",
      weeks: [],
      waves: [],
      milestones: [],
      platformAllocation: {},
      dependencies: [],
      deadlines: [],
      campaignContext: { brandName: "Dolphin Tuna" },
      creatorCount: 0,
      serviceTypes: [],
      generatorVersion: "3.2.3",
    },
    obj
  );

  assert.equal(enriched.campaignContext?.groupName, "Food Group");
  assert.equal(enriched.campaignContext?.agencyName, "Media Agency Egypt");
});
