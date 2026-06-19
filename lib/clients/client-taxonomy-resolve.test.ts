import assert from "node:assert/strict";

import {
  buildClientTaxonomyMetadataMerge,
  readClientTaxonomyFromMetadata,
  resolveClientTaxonomyFromRow,
  wasClientTaxonomyColumnStripped,
} from "./client-taxonomy-resolve";

function run() {
  assert.deepEqual(
    readClientTaxonomyFromMetadata({
      client_category_slug: "marketing_advertising_media_agencies",
      client_subcategory_slug: "media_agency",
      other: "value",
    }),
    {
      client_category: "marketing_advertising_media_agencies",
      client_subcategory: "media_agency",
    }
  );

  assert.equal(readClientTaxonomyFromMetadata({}), null);

  assert.deepEqual(
    resolveClientTaxonomyFromRow({
      client_category: "retail_ecommerce",
      client_subcategory: "fashion",
      metadata: {
        client_category_slug: "marketing_advertising_media_agencies",
        client_subcategory_slug: "media_agency",
      },
    }),
    {
      client_category: "retail_ecommerce",
      client_subcategory: "fashion",
      source: "column",
    }
  );

  assert.deepEqual(
    resolveClientTaxonomyFromRow({
      client_category: null,
      client_subcategory: null,
      metadata: {
        client_category_slug: "marketing_advertising_media_agencies",
        client_subcategory_slug: "media_agency",
      },
    }),
    {
      client_category: "marketing_advertising_media_agencies",
      client_subcategory: "media_agency",
      source: "metadata",
    }
  );

  assert.deepEqual(
    buildClientTaxonomyMetadataMerge(
      { existing: true },
      "marketing_advertising_media_agencies",
      "media_agency"
    ),
    {
      existing: true,
      client_category_slug: "marketing_advertising_media_agencies",
      client_subcategory_slug: "media_agency",
    }
  );

  assert.equal(wasClientTaxonomyColumnStripped(["client_category"]), true);
  assert.equal(wasClientTaxonomyColumnStripped(["name_ar"]), false);

  console.log("client-taxonomy-resolve.test.ts: ok");
}

run();
