import assert from "node:assert/strict";

import { resolveCommercialCategoryLabels } from "./commercial-category-labels";

const brandOnly = resolveCommercialCategoryLabels({
  brandCategoryName: "Banking",
  brandSubcategoryName: "Retail Bank",
  clientCategorySlug: "marketing_advertising_media_agencies",
  clientSubcategorySlug: "media_agency",
});

assert.equal(brandOnly.category, "Banking");
assert.equal(brandOnly.subcategory, "Retail Bank");

const clientFallback = resolveCommercialCategoryLabels({
  clientCategorySlug: "marketing_advertising_media_agencies",
  clientSubcategorySlug: "media_agency",
});

assert.equal(
  clientFallback.category,
  "🧠 Marketing, Advertising & Media Agencies"
);
assert.equal(clientFallback.subcategory, "Media Agency");

const empty = resolveCommercialCategoryLabels({});
assert.equal(empty.category, "—");
assert.equal(empty.subcategory, "—");

console.log("commercial-category-labels.test.ts: ok");
