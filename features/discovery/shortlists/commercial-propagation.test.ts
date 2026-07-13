import assert from "node:assert/strict";

import {
  buildQuotationCommercialPatch,
  shouldSyncQuotationCommercial,
  type QuotationCommercialSnapshot,
} from "./commercial-propagation";

function quote(
  overrides: Partial<QuotationCommercialSnapshot> = {}
): QuotationCommercialSnapshot {
  return {
    id: "q1",
    client_id: null,
    brand_id: null,
    is_temporary_client: false,
    is_temporary_brand: false,
    ...overrides,
  };
}

const oldLink = { client_id: "c-old", brand_id: "b-old" };
const newLink = { client_id: "c-new", brand_id: "b-new" };

assert.equal(shouldSyncQuotationCommercial(quote(), oldLink, newLink), true);
assert.equal(
  shouldSyncQuotationCommercial(quote({ client_id: "c-old", brand_id: "b-old" }), oldLink, newLink),
  true
);
assert.equal(
  shouldSyncQuotationCommercial(quote({ is_temporary_client: true }), oldLink, newLink),
  false
);
assert.equal(
  shouldSyncQuotationCommercial(quote({ is_temporary_brand: true }), oldLink, newLink),
  false
);
assert.equal(
  shouldSyncQuotationCommercial(
    quote({ client_id: "c-other", brand_id: "b-other" }),
    oldLink,
    newLink
  ),
  false
);
assert.equal(
  shouldSyncQuotationCommercial(quote(), oldLink, { client_id: null, brand_id: null }),
  false
);

assert.deepEqual(buildQuotationCommercialPatch({ client_id: "c1", brand_id: "b1" }), {
  client_id: "c1",
  brand_id: "b1",
});
assert.equal(buildQuotationCommercialPatch({ client_id: "c1", brand_id: null }), null);

console.log("commercial-propagation.test.ts: ok");
