import assert from "node:assert/strict";

import {
  aggregateQuotationPriceReference,
  formatQuotationPriceReferenceLabel,
  formatQuotationPriceSegmentHeadline,
} from "@/lib/creators/quotation-price-reference";

const influencerId = "11111111-1111-1111-1111-111111111111";

assert.equal(aggregateQuotationPriceReference(influencerId, []), null);

const reference = aggregateQuotationPriceReference(influencerId, [
  {
    influencer_id: influencerId,
    quotation_id: "q-1",
    cost: 10_000,
    cost_currency: "EGP",
    cost_egp: 10_000,
    deliverables: [{ platform: "instagram", type: "instagram_reel", quantity: 1 }],
    created_at: "2026-06-01T10:00:00.000Z",
    quotations: { serial_number: "QT-2026-0001", name: "Summer", is_archived: false },
  },
  {
    influencer_id: influencerId,
    quotation_id: "q-2",
    cost: 20_000,
    cost_currency: "EGP",
    cost_egp: 20_000,
    deliverables: [],
    created_at: "2026-07-01T10:00:00.000Z",
    quotations: { serial_number: "QT-2026-0002", name: "Ramadan", is_archived: false },
  },
]);

assert.deepEqual(
  {
    influencer_id: reference?.influencer_id,
    quote_count: reference?.quote_count,
    avg_cost: reference?.avg_cost,
    avg_cost_egp: reference?.avg_cost_egp,
    avg_cost_currency: reference?.avg_cost_currency,
    last_quoted_at: reference?.last_quoted_at,
  },
  {
    influencer_id: influencerId,
    quote_count: 2,
    avg_cost: 15_000,
    avg_cost_egp: 15_000,
    avg_cost_currency: "EGP",
    last_quoted_at: "2026-07-01T10:00:00.000Z",
  }
);
assert.equal(reference?.recent_quotes.length, 2);
assert.equal(reference?.recent_quotes[0]?.quotation_serial, "QT-2026-0002");

const tiktokOnly = aggregateQuotationPriceReference(influencerId, [
  {
    influencer_id: influencerId,
    quotation_id: "q-3",
    cost: 300_000,
    cost_currency: "EGP",
    cost_egp: 300_000,
    deliverables: [{ platform: "tiktok", type: "tiktok_video", quantity: 1 }],
    created_at: "2026-07-02T10:00:00.000Z",
    quotations: { serial_number: "QT-2026-0012", name: "TT", is_archived: false },
  },
  {
    influencer_id: influencerId,
    quotation_id: "q-4",
    cost: 500_000,
    cost_currency: "EGP",
    cost_egp: 500_000,
    deliverables: [{ platform: "tiktok", type: "tiktok_video", quantity: 2 }],
    created_at: "2026-07-03T10:00:00.000Z",
    quotations: { serial_number: "QT-2026-0010", name: "TT 2", is_archived: false },
  },
]);

assert.equal(tiktokOnly?.segments.length, 1);
assert.equal(tiktokOnly?.segments[0]?.kind, "platform");
assert.equal(tiktokOnly?.segments[0]?.platform, "tiktok");
assert.equal(tiktokOnly?.segments[0]?.platform_label, "TikTok");
assert.equal(tiktokOnly?.segments[0]?.avg_cost, 400_000);
assert.match(
  formatQuotationPriceReferenceLabel(tiktokOnly!),
  /^TikTok · EGP\s400,000 avg · 2 quotes$/
);

const mixedPackage = aggregateQuotationPriceReference(influencerId, [
  {
    influencer_id: influencerId,
    quotation_id: "q-5",
    cost: 400_000,
    cost_currency: "EGP",
    cost_egp: 400_000,
    deliverables: [
      { platform: "instagram", type: "instagram_reel", quantity: 1 },
      { platform: "tiktok", type: "tiktok_video", quantity: 1 },
    ],
    created_at: "2026-08-01T10:00:00.000Z",
    quotations: { serial_number: "QT-2026-0020", name: "Bundle", is_archived: false },
  },
  {
    influencer_id: influencerId,
    quotation_id: "q-6",
    cost: 300_000,
    cost_currency: "EGP",
    cost_egp: 300_000,
    deliverables: [{ platform: "tiktok", type: "tiktok_video", quantity: 1 }],
    created_at: "2026-08-02T10:00:00.000Z",
    quotations: { serial_number: "QT-2026-0021", name: "TT single", is_archived: false },
  },
]);

assert.equal(mixedPackage?.segments.length, 2);
assert.equal(mixedPackage?.segments[0]?.kind, "package");
assert.equal(mixedPackage?.segments[0]?.avg_cost, 400_000);
assert.equal(mixedPackage?.segments[1]?.kind, "platform");
assert.equal(mixedPackage?.segments[1]?.platform, "tiktok");
assert.match(
  formatQuotationPriceSegmentHeadline(mixedPackage!.segments[0]!),
  /^Package · EGP\s400,000 avg · 1 quote$/
);
assert.match(
  formatQuotationPriceSegmentHeadline(mixedPackage!.segments[1]!),
  /^TikTok · EGP\s300,000 avg · 1 quote$/
);

console.log("quotation-price-reference.test.ts: ok");
