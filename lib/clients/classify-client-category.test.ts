import assert from "node:assert/strict";

import { classifyClientCategory } from "./classify-client-category";

async function expectClassification(
  name: string,
  expected: { categorySlug: string; subcategorySlug: string }
) {
  const result = await classifyClientCategory({ name });
  assert.ok(result, `expected classification for "${name}"`);
  assert.equal(result.categorySlug, expected.categorySlug, name);
  assert.equal(result.subcategorySlug, expected.subcategorySlug, name);
}

async function run() {
  await expectClassification("Nike", {
    categorySlug: "fashion_apparel",
    subcategorySlug: "sportswear",
  });

  await expectClassification("Omnicom Group", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "advertising_agency",
  });

  await expectClassification("WPP Media", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "advertising_agency",
  });

  await expectClassification("Mind Share Egypt", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  });

  await expectClassification("Mind Share Egypt LTD", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  });

  await expectClassification("Mindshare", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  });

  await expectClassification("GroupM MENA", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_investment_management",
  });

  console.log("classify-client-category.test.ts: ok");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
