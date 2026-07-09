import assert from "node:assert/strict";

import { aggregateQuotationPriceReference } from "@/lib/creators/quotation-price-reference";

const influencerId = "11111111-1111-1111-1111-111111111111";

assert.equal(aggregateQuotationPriceReference(influencerId, []), null);

const reference = aggregateQuotationPriceReference(influencerId, [
  {
    influencer_id: influencerId,
    quotation_id: "q-1",
    cost: 10_000,
    cost_currency: "EGP",
    cost_egp: 10_000,
    deliverables: [{ platform: "instagram", type: "reel", quantity: 1 }],
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

console.log("quotation-price-reference.test.ts: ok");
