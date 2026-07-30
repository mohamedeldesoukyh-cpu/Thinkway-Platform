import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countCommercialHealth, filterCommercialWorkspaceRows } from "./filters";

const rows = [
  {
    itemId: "a",
    influencerName: "Ali",
    revenueEgp: 100,
    costEgp: 70,
    gpValueEgp: 30,
    gpPct: 30,
  },
  {
    itemId: "b",
    influencerName: "Bob",
    revenueEgp: 100,
    costEgp: 85,
    gpValueEgp: 15,
    gpPct: 15,
  },
  {
    itemId: "c",
    influencerName: "Cara",
    revenueEgp: 100,
    costEgp: 95,
    gpValueEgp: 5,
    gpPct: 5,
  },
  {
    itemId: "d",
    influencerName: "Dan",
    revenueEgp: 0,
    costEgp: 10,
    gpValueEgp: -10,
    gpPct: 0,
  },
];

describe("commercial workspace filters", () => {
  it("filters by band and missing revenue", () => {
    assert.deepEqual(
      filterCommercialWorkspaceRows(rows, "band_healthy", "").map((r) => r.itemId),
      ["a"]
    );
    assert.deepEqual(
      filterCommercialWorkspaceRows(rows, "missing_revenue", "").map((r) => r.itemId),
      ["d"]
    );
    assert.deepEqual(
      filterCommercialWorkspaceRows(rows, "negative_gp", "").map((r) => r.itemId),
      ["d"]
    );
  });

  it("counts commercial health", () => {
    assert.deepEqual(countCommercialHealth(rows), {
      healthy: 1,
      warning: 1,
      critical: 2,
    });
  });
});
