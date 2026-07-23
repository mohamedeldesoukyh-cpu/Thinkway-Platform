import assert from "node:assert/strict";

import { browseIdStagePinTier } from "@/lib/creators/discovery-browse-id-stage-tier";
import { browsePinTier } from "@/lib/creators/browse-pin-tier";

assert.equal(
  browseIdStagePinTier({
    enrichment_status: "enriched",
    last_enriched_at: "2026-07-01T00:00:00.000Z",
  }),
  2
);

assert.equal(
  browseIdStagePinTier({
    enrichment_status: "enriched",
    last_enriched_at: null,
    updated_at: null,
  }),
  3
);

assert.equal(
  browseIdStagePinTier({
    enrichment_status: "never",
    updated_at: "2026-07-01T00:00:00.000Z",
  }),
  4
);

assert.equal(
  browseIdStagePinTier({
    enrichment_status: "never",
    last_enriched_at: null,
    updated_at: null,
  }),
  5
);

// Without platforms, full pin tiers collapse to the same ID-stage bands.
const withoutPlatforms = {
  country_code: "EG",
  country_codes: ["EG"],
  estimated_country: null,
  platforms: [],
  last_enriched_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  enrichment_status: "enriched" as const,
};

assert.equal(browsePinTier(withoutPlatforms), 2);
assert.equal(
  browseIdStagePinTier(withoutPlatforms),
  browsePinTier(withoutPlatforms),
  "ID-stage tier must match full pin tier when platforms are empty"
);

console.log("lib/creators/discovery-browse-id-stage-tier.test.ts — all tests passed");
