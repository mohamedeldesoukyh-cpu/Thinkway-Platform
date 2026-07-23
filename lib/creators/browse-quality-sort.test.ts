import assert from "node:assert/strict";

import {
  compareBrowseQualityRank,
  compareMultiPlatformCount,
  countCreatorPlatforms,
} from "@/lib/creators/browse-quality-sort";

const platform = (name: string, id: string) => ({
  id,
  platform: name,
  handle: id,
  profile_url: null,
  follower_count: 100,
  engagement_rate: 2,
  audience_country: "US",
});

assert.equal(countCreatorPlatforms({ platforms: [] }), 0);
assert.equal(
  countCreatorPlatforms({
    platforms: [platform("tiktok", "p1"), platform("instagram", "p2"), platform("tiktok", "p3")],
  }),
  2,
  "counts distinct platforms only"
);

const enrichedSingle = {
  enrichment_status: "enriched" as const,
  last_enriched_at: "2026-07-18T00:00:00.000Z",
  updated_at: null,
  platforms: [platform("tiktok", "p1")],
};
const enrichedMulti = {
  enrichment_status: "enriched" as const,
  last_enriched_at: "2026-07-18T00:00:00.000Z",
  updated_at: null,
  platforms: [platform("tiktok", "p1"), platform("instagram", "p2")],
};
const partialMulti = {
  enrichment_status: "partial" as const,
  last_enriched_at: "2026-07-18T00:00:00.000Z",
  updated_at: null,
  platforms: [platform("tiktok", "p1"), platform("youtube", "p2"), platform("instagram", "p3")],
};

assert.ok(
  compareMultiPlatformCount(enrichedSingle, enrichedMulti) > 0,
  "multi-platform ranks above single-platform"
);
assert.ok(
  compareBrowseQualityRank(enrichedMulti, enrichedSingle) < 0,
  "enriched multi-platform ranks above enriched single-platform"
);
assert.ok(
  compareBrowseQualityRank(enrichedMulti, partialMulti) < 0,
  "enriched ranks above partial even when partial has more platforms"
);

console.log("lib/creators/browse-quality-sort.test.ts — all tests passed");
