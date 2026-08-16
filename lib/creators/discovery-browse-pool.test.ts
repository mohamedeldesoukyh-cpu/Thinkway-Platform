import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildDiscoveryBrowseVisibilityPatch,
} from "@/lib/creators/discovery-browse-eligibility";
import { queryActiveInfluencerIdsByRecencyFast } from "@/lib/creators/discovery-browse-pool";

assert.deepEqual(
  buildDiscoveryBrowseVisibilityPatch({ status: "prospect" }, { nowIso: "2026-07-18T00:00:00.000Z" }),
  {
    status: "active",
    updated_at: "2026-07-18T00:00:00.000Z",
  },
  "prospect discovery creators must activate for browse SQL pool"
);

const poolSource = fs.readFileSync(
  path.join(process.cwd(), "lib/creators/discovery-browse-pool.ts"),
  "utf8"
);

assert.match(
  poolSource,
  /IN_FILTER_BATCH_SIZE = 80/,
  "discovery browse pool must chunk large .in() filters"
);

assert.match(
  poolSource,
  /queryActiveInfluencerIdsByRecencyFast/,
  "unfiltered browse must have an indexed ID path that skips count(*) OVER ()"
);

async function main() {
  const empty = await queryActiveInfluencerIdsByRecencyFast({} as never, {}, 1, 0);
  assert.deepEqual(empty, { ids: [], hasMore: false });

  console.log("lib/creators/discovery-browse-pool.test.ts — all tests passed");
}

void main();
