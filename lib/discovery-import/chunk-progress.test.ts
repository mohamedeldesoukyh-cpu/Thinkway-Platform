import assert from "node:assert/strict";

import { CREATOR_IMPORT_CHUNK_SIZE } from "./constants";
import {
  aggregateChunkCounters,
  chunkProgressPercent,
  isChunkCompleted,
  readImportPipelineMetadata,
} from "./chunk-progress";
import { splitCreatorRows } from "./process";
import type { ParsedCreatorRow } from "./types";

function makeRow(index: number): ParsedCreatorRow {
  return {
    username: `creator_${index}`,
    display_name: null,
    platform: "instagram",
    followers: 1000,
    engagement_rate: 0.05,
    country: "US",
    source: "test",
    categories: [],
    audience_interests: [],
    relevance_score: null,
    profile_picture_url: null,
    role: null,
  };
}

assert.equal(CREATOR_IMPORT_CHUNK_SIZE, 100);

const rows = Array.from({ length: 250 }, (_, index) => makeRow(index));
const chunks = splitCreatorRows(rows);
assert.equal(chunks.length, 3);
assert.equal(chunks[0]?.length, 100);
assert.equal(chunks[1]?.length, 100);
assert.equal(chunks[2]?.length, 50);

const pipeline = readImportPipelineMetadata({
  import_pipeline: {
    total_chunks: 3,
    chunk_results: {
      "0": {
        total: 100,
        imported: 80,
        updated: 10,
        duplicate: 5,
        failed: 5,
      },
      "1": {
        total: 100,
        imported: 70,
        updated: 20,
        duplicate: 5,
        failed: 5,
      },
    },
  },
});

assert.equal(isChunkCompleted(pipeline, 0), true);
assert.equal(isChunkCompleted(pipeline, 2), false);
assert.equal(chunkProgressPercent(pipeline), 67);

const totals = aggregateChunkCounters(pipeline);
assert.deepEqual(totals, {
  total: 200,
  imported: 150,
  updated: 30,
  skipped: 0,
  duplicate: 10,
  failed: 10,
  platform_accounts_created: 0,
  platform_accounts_updated: 0,
  followers_updated: 0,
  categories_updated: 0,
  audience_interests_updated: 0,
  avatars_imported: 0,
  missing_avatars: 0,
});

console.log("chunk-progress.test.ts: all assertions passed");
