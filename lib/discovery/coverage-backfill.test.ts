import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCoverageBackfillJobPayloadFromIntent,
  buildCoverageBackfillJobPayloadFromBrowseFilters,
  buildCoverageBackfillJobPayloadsFromIntent,
  browseFiltersHaveBackfillIntent,
} from "./coverage-backfill";

test("browseFiltersHaveBackfillIntent detects country/category/search", () => {
  assert.equal(
    browseFiltersHaveBackfillIntent({ country: "EG", categories: ["Sports"] }),
    true
  );
  assert.equal(browseFiltersHaveBackfillIntent({ page: 1 }), false);
});

test("browseFiltersHaveBackfillIntent skips exact handle and profile URL lookups", () => {
  assert.equal(browseFiltersHaveBackfillIntent({ search: "@uaesupersport" }), false);
  assert.equal(
    browseFiltersHaveBackfillIntent({
      search: "https://www.instagram.com/uaesupersport/",
    }),
    false
  );
  assert.equal(browseFiltersHaveBackfillIntent({ search: "adidas running egypt" }), true);
});

test("C19-style payload prefers hashtag seed over ISO country location query", () => {
  const payload = buildCoverageBackfillJobPayloadFromIntent({
    country: "EG",
    categories: ["Sports", "Fitness"],
    platforms: ["instagram"],
    searchText: "adidas running sportswear egypt",
  });

  assert.equal(payload.method, "location");
  assert.equal(payload.platform, "instagram");
  assert.equal(payload.locationQuery, "adidasegypt");
  assert.equal(payload.coverageIntent?.country, "EG");
});

test("country-only payload uses city query not ISO code", () => {
  const payload = buildCoverageBackfillJobPayloadFromIntent({
    country: "EG",
    platforms: ["instagram"],
  });

  assert.equal(payload.method, "location");
  assert.equal(payload.locationCountry, "EG");
  assert.equal(payload.locationQuery, "egypt");
});

test("browse filters map to backfill payload", () => {
  const payload = buildCoverageBackfillJobPayloadFromBrowseFilters({
    search: "running",
    country: "EG",
    categories: ["Sports"],
    platforms: ["instagram", "tiktok"],
    page: 1,
    pageSize: 20,
  });

  assert.equal(payload.method, "location");
  assert.equal(payload.locationQuery, "runningegypt");
  assert.equal(payload.platform, "instagram");
});

test("multi-platform brief enqueues one payload per platform", () => {
  const payloads = buildCoverageBackfillJobPayloadsFromIntent({
    country: "EG",
    niches: ["skincare"],
    categories: ["Beauty"],
    platforms: ["instagram", "tiktok"],
    searchText: "skincare vitamin c",
  });

  assert.equal(payloads.length, 2);
  assert.deepEqual(
    payloads.map((payload) => payload.platform),
    ["instagram", "tiktok"]
  );
  assert.equal(payloads[0]?.locationQuery, "skincareegypt");
  assert.equal(payloads[1]?.locationQuery, "skincareegypt");
});
