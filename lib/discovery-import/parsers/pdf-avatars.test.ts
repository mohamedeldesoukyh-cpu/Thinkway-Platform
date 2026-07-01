import assert from "node:assert/strict";

import {
  measureRgbaWhiteRatio,
  splitImportRowsAcrossPages,
} from "./pdf-avatars";

assert.equal(
  measureRgbaWhiteRatio([255, 255, 255, 255, 10, 10, 10, 255], 2),
  0.5
);

assert.equal(measureRgbaWhiteRatio([], 0), 1);

const rows = Array.from({ length: 57 }, (_, index) => ({
  username: `user_${index}`,
  display_name: null,
  platform: "instagram",
  followers: null,
  engagement_rate: null,
  country: null,
  source: null,
  categories: [],
  audience_interests: [],
  relevance_score: null,
  profile_picture_url: null,
  role: null,
  appearances: null,
}));

const chunks = splitImportRowsAcrossPages(rows, [20, 20, 17]);
assert.equal(chunks.length, 3);
assert.equal(chunks[0]!.length, 20);
assert.equal(chunks[1]!.length, 20);
assert.equal(chunks[2]!.length, 17);
assert.equal(chunks.flat().length, 57);

const evenChunks = splitImportRowsAcrossPages(rows.slice(0, 10), [0, 0]);
assert.equal(evenChunks.flat().length, 10);

console.log("lib/discovery-import/parsers/pdf-avatars.test.ts — all tests passed");
