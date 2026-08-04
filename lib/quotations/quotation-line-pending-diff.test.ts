import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverableSnapshot,
  linePendingDiffersFromItem,
} from "./quotation-line-pending-diff";
import type { QuotationItemRow } from "@/features/quotations/types";

const baseItem = {
  id: "item-1",
  service_description: "IG Reel",
  option_number: 1,
  platform: "instagram",
  handle: "@creator",
  followers: 1000,
  engagement_rate: 2.5,
  cost: 100,
  revenue: 150,
  gp_pct: 33,
  gp_value: 50,
  deliverables: [
    {
      platform: "instagram",
      type: "ig_reel",
      quantity: 1,
      revenue: 150,
      cost: 100,
      cost_currency: "EGP",
      commercial_input_mode: "cost_revenue",
    },
  ],
} as unknown as QuotationItemRow;

test("linePendingDiffersFromItem returns false for identical deliverables", () => {
  assert.equal(
    linePendingDiffersFromItem(baseItem, {
      deliverables: baseItem.deliverables,
      revenue: 150,
      cost: 100,
      gp_pct: 33,
      gp_value: 50,
    }),
    false
  );
});

test("linePendingDiffersFromItem detects Master cost change when deliverables unchanged", () => {
  assert.equal(
    linePendingDiffersFromItem(baseItem, {
      deliverables: baseItem.deliverables,
      cost: 21000,
      revenue: 150,
      gp_pct: 33,
      gp_value: 50,
    }),
    true
  );
});

test("linePendingDiffersFromItem detects service description edits", () => {
  assert.equal(
    linePendingDiffersFromItem(baseItem, { service_description: "Updated" }),
    true
  );
});

test("deliverableSnapshot ignores noop commercial patch", () => {
  const deliverable = baseItem.deliverables[0]!;
  assert.equal(deliverableSnapshot(deliverable), deliverableSnapshot({ ...deliverable }));
});
