import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  compareBrowseRecencyDesc,
  compareByLastEnrichedRecency,
} from "@/lib/creators/last-enriched-sort";

const NOW = Date.parse("2026-07-18T12:00:00.000Z");
const DAY = 86_400_000;

const enrichedYesterday = {
  unified_id: "inf:old",
  last_enriched_at: new Date(NOW - DAY).toISOString(),
  updated_at: new Date(NOW - DAY).toISOString(),
  thinkway_score: 99,
};

const newlyAdded = {
  unified_id: "inf:new",
  last_enriched_at: null,
  updated_at: new Date(NOW - 60_000).toISOString(),
  thinkway_score: 10,
};

assert.ok(
  compareBrowseRecencyDesc(newlyAdded, enrichedYesterday, NOW) < 0,
  "recently added creator ranks ahead of older enriched creator"
);

assert.ok(
  compareByLastEnrichedRecency(newlyAdded, enrichedYesterday, "desc", NOW) < 0,
  "updated_at fallback keeps newly added creators ahead in recency compare"
);

const source = fs.readFileSync(
  path.join(process.cwd(), "lib/creators/unified-browse.ts"),
  "utf8"
);

assert.match(
  source,
  /queryBrowsableInfluencerIdsByRecency/,
  "fallback browse id query must use recency browse pool"
);

assert.match(
  source,
  /sortBrowseCreatorsInDefaultOrder/,
  "unfiltered browse merge must sort by browse pin tiers"
);

console.log("lib/creators/unified-browse-recency.test.ts — all tests passed");
