import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeDeliverableDraftsFromServer,
  newDeliverableKey,
  toDeliverableDrafts,
} from "./quotation-deliverable-drafts";
import type { QuotationItemRow } from "@/features/quotations/types";

const baseItem = {
  id: "item-1",
  platform: "instagram",
  deliverables: [
    {
      platform: "instagram",
      type: "ig_reel",
      types: ["ig_reel", "ig_story"],
      type_lines: [
        { type: "ig_reel", quantity: 1 },
        { type: "ig_story", quantity: 1 },
      ],
      quantity: 1,
      revenue: 20911,
      cost: 15000,
      cost_currency: "EGP",
      commercial_input_mode: "cost_gp_pct",
      gp_pct: 30,
      service_description: "1 reel + set of stories",
    },
  ],
} as unknown as QuotationItemRow;

test("mergeDeliverableDraftsFromServer does not duplicate after local d- key save", () => {
  const localKey = newDeliverableKey();
  const prev = [
    {
      key: localKey,
      platform: "instagram",
      type: "ig_reel",
      types: ["ig_reel", "ig_story"],
      type_lines: [
        { type: "ig_reel", quantity: 1 },
        { type: "ig_story", quantity: 1 },
      ],
      quantity: 1,
      revenue: 20911,
      cost: 15000,
      cost_currency: "EGP",
      commercial_input_mode: "cost_gp_pct" as const,
      gp_pct: 30,
      service_description: "1 reel + set of stories",
    },
  ];

  const merged = mergeDeliverableDraftsFromServer(prev, baseItem, ["instagram"]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.key, "existing-0");
  assert.equal(merged[0]?.service_description, "1 reel + set of stories");
  assert.equal(merged[0]?.revenue, 20911);
});

test("mergeDeliverableDraftsFromServer keeps unsaved extra local pricing line", () => {
  const savedLocalKey = newDeliverableKey();
  const unsavedLocalKey = newDeliverableKey();
  const prev = [
    {
      key: savedLocalKey,
      platform: "instagram",
      type: "ig_reel",
      type_lines: [{ type: "ig_reel", quantity: 1 }],
      quantity: 1,
      revenue: 20911,
      cost: 15000,
      cost_currency: "EGP",
      service_description: "Saved line",
    },
    {
      key: unsavedLocalKey,
      platform: "instagram",
      type: "",
      type_lines: [{ type: "", quantity: 1 }],
      quantity: 1,
      revenue: null,
      service_description: null,
    },
  ];

  const merged = mergeDeliverableDraftsFromServer(prev, baseItem, ["instagram"]);

  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.key, "existing-0");
  assert.equal(merged[1]?.key, unsavedLocalKey);
});

test("mergeDeliverableDraftsFromServer preserves local when preserveLocal is true", () => {
  const localKey = newDeliverableKey();
  const prev = toDeliverableDrafts(baseItem.deliverables).map((draft, index) =>
    index === 0 ? { ...draft, key: localKey } : draft
  );

  const merged = mergeDeliverableDraftsFromServer(prev, baseItem, ["instagram"], {
    preserveLocal: true,
  });

  assert.deepEqual(merged, prev);
});
