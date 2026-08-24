import assert from "node:assert/strict";

import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { hasPricedDeliverables } from "@/lib/quotations/quotation-deliverable-rollup";
import {
  deliverablesPatchForLineMasterSave,
  resolveQuotationDeliverablesWrite,
  stripDeliverableCommercialAmounts,
} from "@/lib/quotations/quotation-line-commercial-ssot";

const priced: QuotationDeliverable = {
  platform: "instagram",
  type: "reel",
  quantity: 1,
  cost: 20000,
  revenue: 26000,
  gp_pct: 23,
  gp_value: 6000,
  af_pct: 0,
  commercial_input_mode: "cost_revenue",
  free_for_client: false,
};

{
  const stripped = stripDeliverableCommercialAmounts([priced]);
  assert.equal(stripped[0]!.cost, null);
  assert.equal(stripped[0]!.revenue, null);
  assert.equal(stripped[0]!.gp_pct, null);
  assert.equal(stripped[0]!.free_for_client, false);
  assert.equal(stripped[0]!.platform, "instagram");
  assert.equal(stripped[0]!.type, "reel");
  assert.equal(hasPricedDeliverables(stripped), false);
}

{
  assert.equal(deliverablesPatchForLineMasterSave([]), null);
  assert.equal(deliverablesPatchForLineMasterSave([{ ...priced, cost: 0, revenue: 0 }]), null);
  const patch = deliverablesPatchForLineMasterSave([priced]);
  assert.ok(patch);
  assert.equal(hasPricedDeliverables(patch!), false);
  assert.equal(patch![0]!.cost, null);
}

{
  const incoming = [{ ...priced, cost: 5000, revenue: null, commercial_input_mode: "cost_revenue" as const }];
  const persisted = resolveQuotationDeliverablesWrite({ incoming });
  assert.equal(persisted?.[0]!.cost, 5000);
  assert.equal(resolveQuotationDeliverablesWrite({ existing: [priced] })?.[0]!.cost, null);
  assert.equal(resolveQuotationDeliverablesWrite({}), undefined);
}

console.log("quotation-line-commercial-ssot.test.ts: all assertions passed");
