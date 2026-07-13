import assert from "node:assert/strict";
import test from "node:test";

import { mergeQuotationCommercialsContext } from "./quotation-commercials-meta";

test("mergeQuotationCommercialsContext preserves creators and fills missing group", () => {
  const merged = mergeQuotationCommercialsContext(
    {
      syncedAt: "2026-01-01T00:00:00.000Z",
      creators: [
        {
          creatorId: "c1",
          displayName: "Nour",
          serviceTypes: ["1× IG Reel"],
        },
      ],
      brandName: "Dolphin Tuna",
    },
    {
      groupName: "Food Group",
      agencyOrDirect: "agency",
      agencyName: "Media Agency Egypt",
    }
  );

  assert.equal(merged.brandName, "Dolphin Tuna");
  assert.equal(merged.groupName, "Food Group");
  assert.equal(merged.agencyName, "Media Agency Egypt");
  assert.equal(merged.creators.length, 1);
});

test("mergeQuotationCommercialsContext clears agency when client is direct", () => {
  const merged = mergeQuotationCommercialsContext(
    {
      syncedAt: "2026-01-01T00:00:00.000Z",
      creators: [],
      brandName: "Dolphin Tuna",
      groupName: "Food Group",
      agencyOrDirect: "agency",
      agencyName: "Old Agency",
    },
    {
      agencyOrDirect: "direct",
    }
  );

  assert.equal(merged.groupName, "Food Group");
  assert.equal(merged.agencyOrDirect, "direct");
  assert.equal(merged.agencyName, undefined);
});
