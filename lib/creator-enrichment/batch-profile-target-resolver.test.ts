import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSocialPlatform } from "@/lib/social/normalize-platform";
import { isSocialPlatform } from "@/lib/social/platforms";

import { groupBatchTargetsByPlatform } from "./batch-profile-target-resolver";
import type { BatchProfileTarget } from "./batch-profile-acquisition-types";

function target(
  platform: BatchProfileTarget["platform"],
  username: string
): BatchProfileTarget {
  return {
    unifiedId: "inf:creator-1",
    platform,
    username,
    profileUrl: `https://example.com/${username}`,
    influencerId: "creator-1",
    discoveredProfileId: null,
    platformAccountId: `${platform}-pa`,
  };
}

test("canonicalizes Snapchat platform casing for batch targets", () => {
  assert.equal(isSocialPlatform("Snapchat"), false);
  assert.equal(normalizeSocialPlatform("Snapchat"), "snapchat");
  assert.equal(isSocialPlatform("snapchat"), true);
});

test("groups instagram and snapchat targets into separate platform batches", () => {
  const grouped = groupBatchTargetsByPlatform([
    target("instagram", "creator"),
    target("snapchat", "creator"),
  ]);

  assert.equal(grouped.get("instagram")?.length, 1);
  assert.equal(grouped.get("snapchat")?.length, 1);
});

test("preserves multiple snapchat targets in the same batch bucket", () => {
  const grouped = groupBatchTargetsByPlatform([
    target("snapchat", "creator-a"),
    target("snapchat", "creator-b"),
  ]);

  assert.equal(grouped.get("snapchat")?.length, 2);
});
