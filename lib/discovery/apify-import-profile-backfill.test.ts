import assert from "node:assert/strict";

import {
  shouldBackfillInstagramProfileDetails,
} from "@/lib/discovery/apify-import-profile-backfill";
import type { ApifyProfileData } from "@/lib/creator-enrichment/types";

const POST_ONLY = [{ id: "post-1", playCount: 12_000, commentCount: 4 }];
const PROFILE_ROW = [{ username: "hgabr", followersCount: 639_850, biography: "Athlete" }];

const partialNormalized = {
  followers: null,
  avgViews: 439_900,
} as ApifyProfileData;

assert.equal(
  shouldBackfillInstagramProfileDetails("instagram", [], POST_ONLY, partialNormalized),
  true,
  "post-only Instagram import without followers should backfill profile details"
);

assert.equal(
  shouldBackfillInstagramProfileDetails("instagram", PROFILE_ROW, POST_ONLY, {
    ...partialNormalized,
    followers: 639_850,
  } as ApifyProfileData),
  false,
  "skip backfill when profile rows already include followers"
);

assert.equal(
  shouldBackfillInstagramProfileDetails("tiktok", [], POST_ONLY, partialNormalized),
  false,
  "TikTok post rows include authorMeta.fans — no Instagram backfill"
);

console.log("apify-import-profile-backfill.test.ts: all assertions passed");
