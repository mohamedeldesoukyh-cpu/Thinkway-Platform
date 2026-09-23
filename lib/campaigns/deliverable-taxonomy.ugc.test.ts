import assert from "node:assert/strict";
import { test } from "node:test";
import { SOCIAL_PLATFORM_OPTIONS } from "@/lib/master-data/constants";
import { coerceDeliverableTypeForPlatform, deliverableTypeLabel, deliverableTypeShortLabel, getDeliverableTypesForPlatform, PLATFORM_DELIVERABLE_CODES } from "./deliverable-taxonomy";

test("UGC Video is selectable and preserved on every platform and aliases", () => {
  for (const platform of [...SOCIAL_PLATFORM_OPTIONS.map(p => p.value), "IG", "TT", "unknown"]) {
    const options = getDeliverableTypesForPlatform(platform);
    assert.equal(options.filter(type => type.value === "ugc_video").length, 1, platform);
    assert.equal(coerceDeliverableTypeForPlatform(platform, "ugc_video", "https://instagram.com/reel/test"), "ugc_video", platform);
  }
  for (const codes of Object.values(PLATFORM_DELIVERABLE_CODES)) assert.ok(codes.includes("ugc_video"));
  assert.equal(deliverableTypeLabel("ugc_video"), "UGC Video");
  assert.equal(deliverableTypeShortLabel("ugc_video"), "UGC Video");
});

test("adding UGC Video preserves platform defaults and existing types", () => {
  assert.equal(getDeliverableTypesForPlatform("instagram")[0].value, "instagram_post");
  assert.equal(getDeliverableTypesForPlatform("tiktok")[0].value, "tiktok_video");
  assert.equal(coerceDeliverableTypeForPlatform("instagram", "instagram_reel"), "instagram_reel");
});
