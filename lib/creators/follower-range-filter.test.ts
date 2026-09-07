import assert from "node:assert/strict";
import test from "node:test";

import {
  filtersToBrowseParams,
  withCreatorSearchFollowerRanges,
  cloneCreatorSearchFilters,
} from "@/features/discovery/components/creator-search/creator-search-types";
import {
  applyCreatorSearchFiltersToUrlParams,
  creatorSearchFiltersFromUrlParams,
  creatorSearchFiltersUrlEqual,
} from "@/lib/creators/creator-search-url-params";
import {
  followerCountMatchesBrowseRanges,
  formatFollowerRangeToken,
  parseFollowerRangeToken,
  resolveBrowseFollowerRanges,
  resolveCreatorSearchFollowerRanges,
  toggleFollowerRangeInList,
} from "@/lib/creators/follower-range-filter";

test("toggleFollowerRangeInList adds and removes bands", () => {
  const micro = { min: "10000", max: "99999" };
  const mid = { min: "100000", max: "499999" };
  const once = toggleFollowerRangeInList([], micro);
  assert.deepEqual(once, [micro]);
  const twice = toggleFollowerRangeInList(once, mid);
  assert.equal(twice.length, 2);
  assert.deepEqual(toggleFollowerRangeInList(twice, micro), [mid]);
});

test("parse/format follower range tokens round-trip", () => {
  assert.deepEqual(parseFollowerRangeToken("10000-99999"), {
    min: "10000",
    max: "99999",
  });
  assert.deepEqual(parseFollowerRangeToken("5000000-"), {
    min: "5000000",
    max: "",
  });
  assert.equal(
    formatFollowerRangeToken({ min: "5000000", max: "" }),
    "5000000-"
  );
});

test("followerCountMatchesBrowseRanges ORs bands", () => {
  const ranges = [
    { min: 10_000, max: 99_999 },
    { min: 100_000, max: 499_999 },
  ];
  assert.equal(followerCountMatchesBrowseRanges(50_000, ranges), true);
  assert.equal(followerCountMatchesBrowseRanges(250_000, ranges), true);
  assert.equal(followerCountMatchesBrowseRanges(5_000, ranges), false);
  assert.equal(followerCountMatchesBrowseRanges(600_000, ranges), false);
});

test("filtersToBrowseParams emits followerRanges for multi-band", () => {
  const filters = withCreatorSearchFollowerRanges(cloneCreatorSearchFilters(), [
    { min: "10000", max: "99999" },
    { min: "100000", max: "499999" },
  ]);
  const params = filtersToBrowseParams(filters, 1, 24);
  assert.equal(params.minFollowers, undefined);
  assert.equal(params.maxFollowers, undefined);
  assert.deepEqual(params.followerRanges, [
    { min: 10_000, max: 99_999 },
    { min: 100_000, max: 499_999 },
  ]);
});

test("filtersToBrowseParams keeps singular min/max for one band", () => {
  const filters = withCreatorSearchFollowerRanges(cloneCreatorSearchFilters(), [
    { min: "10000", max: "99999" },
  ]);
  const params = filtersToBrowseParams(filters, 1, 24);
  assert.equal(params.minFollowers, 10_000);
  assert.equal(params.maxFollowers, 99_999);
  assert.equal(params.followerRanges, undefined);
});

test("URL round-trip preserves multi follower bands", () => {
  const filters = withCreatorSearchFollowerRanges(cloneCreatorSearchFilters(), [
    { min: "10000", max: "99999" },
    { min: "500000", max: "999999" },
  ]);
  const params = applyCreatorSearchFiltersToUrlParams(new URLSearchParams(), filters);
  assert.deepEqual(params.getAll("followers"), ["10000-99999", "500000-999999"]);
  assert.equal(params.get("minFollowers"), null);
  const restored = creatorSearchFiltersFromUrlParams(params);
  assert.ok(
    creatorSearchFiltersUrlEqual(filters, restored),
    "multi-band URL equality"
  );
  assert.deepEqual(resolveCreatorSearchFollowerRanges(restored), [
    { min: "10000", max: "99999" },
    { min: "500000", max: "999999" },
  ]);
});

test("legacy min/max URL still resolves to one band", () => {
  const params = new URLSearchParams("minFollowers=10000&maxFollowers=99999");
  const filters = creatorSearchFiltersFromUrlParams(params);
  assert.deepEqual(resolveCreatorSearchFollowerRanges(filters), [
    { min: "10000", max: "99999" },
  ]);
  assert.deepEqual(resolveBrowseFollowerRanges(filtersToBrowseParams(filters, 1, 24)), [
    { min: 10_000, max: 99_999 },
  ]);
});
