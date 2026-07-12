import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import {
  buildAdditionChanges,
  buildRemovalChanges,
  creatorToDraftRef,
  slateCreatorIdSet,
} from "./slate-edit-mutations";

function creator(id: string, name: string, followers = 500_000): UnifiedCreatorResult {
  return {
    unified_id: `inf:${id}`,
    influencer_id: id,
    display_name: name,
    platforms: [{ id: "p", platform: "tiktok", handle: name.toLowerCase() }],
    metrics: { followers: { value: followers, confidence: "high" } },
    primaryAvatarUrl: "https://cdn/x.jpg",
    profile_image_url: null,
  } as unknown as UnifiedCreatorResult;
}

test("creatorToDraftRef builds a discovery add ref with manual enrichment", () => {
  const ref = creatorToDraftRef(creator("a", "Salma", 1_500_000));
  assert.equal(ref.creatorId, "inf:a");
  assert.equal(ref.displayName, "Salma");
  assert.equal(ref.platform, "tiktok");
  assert.equal(ref.followers, 1_500_000);
  assert.equal(ref.source, "discovery");
  assert.equal(ref.enrichmentStatus, "not_requested");
});

test("buildAdditionChanges / buildRemovalChanges produce typed draft changes", () => {
  const adds = buildAdditionChanges([creator("a", "A"), creator("b", "B")]);
  assert.equal(adds.length, 2);
  assert.ok(adds.every((c) => c.kind === "add_creator"));

  const removes = buildRemovalChanges([creator("a", "A")]);
  assert.equal(removes.length, 1);
  assert.equal(removes[0]?.kind, "remove_creator");
});

test("slateCreatorIdSet normalizes the current slate ids", () => {
  const obj = {
    sections: {
      creators: { data: { recommendations: { creatorIds: ["inf:a", "b", "dis:c"] } } },
    },
  } as unknown as CampaignObject;
  const set = slateCreatorIdSet(obj);
  assert.ok(set.has("a"));
  assert.ok(set.has("b"));
  assert.ok(set.has("dis:c"));
});
