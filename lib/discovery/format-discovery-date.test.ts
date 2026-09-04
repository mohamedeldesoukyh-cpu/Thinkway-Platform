import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDiscoveryDate } from "@/lib/discovery/format-discovery-date";

test("formats Discovery dates as DD Mon YY", () => {
  assert.equal(formatDiscoveryDate("31/07/2026"), "31 Jul 26");
  assert.equal(formatDiscoveryDate(new Date(2026, 7, 4)), "04 Aug 26");
});

test("preserves already-formatted and unparseable values", () => {
  assert.equal(formatDiscoveryDate("03 Sep 26"), "03 Sep 26");
  assert.equal(formatDiscoveryDate("date pending"), "date pending");
});

test("returns an empty string for missing dates", () => {
  assert.equal(formatDiscoveryDate(null), "");
  assert.equal(formatDiscoveryDate(""), "");
});
