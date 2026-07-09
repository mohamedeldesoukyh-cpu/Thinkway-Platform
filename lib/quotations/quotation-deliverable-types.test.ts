import assert from "node:assert/strict";

import {
  deliverableTypeLines,
  formatTypeLinesSummary,
  formatQuotationDeliverablesSummary,
  isPostTypeAllowedForCreator,
  platformsFromSelectedPostTypes,
  postTypePlatformKey,
  quotationPostTypeLabel,
  selectedTypesFromTypeLines,
  syncDeliverableFromTypeLines,
  typeLinesFromSelectedTypes,
  typeLinesIncludeAllPlatforms,
} from "@/lib/quotations/quotation-deliverable-types";

{
  const lines = deliverableTypeLines({
    types: ["instagram_reel", "instagram_story"],
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.type, "instagram_reel");
  assert.equal(lines[1]?.type, "instagram_story");
  assert.equal(lines[0]?.quantity, 1);
}

{
  const lines = deliverableTypeLines({
    type_lines: [
      { type: "instagram_reel", quantity: 1 },
      { type: "instagram_story", quantity: 2 },
    ],
  });
  assert.equal(formatTypeLinesSummary(lines), "1× IG Reel + 2× IG Story");
}

{
  const synced = syncDeliverableFromTypeLines(
    [
      { type: "video", quantity: 1 },
      { type: "stories", quantity: 2 },
    ],
    ["instagram"],
    "instagram"
  );
  assert.equal(synced.types.join(","), "video,stories");
  assert.equal(synced.platform, "instagram");
}

assert.equal(isPostTypeAllowedForCreator("video", []), true);
assert.equal(isPostTypeAllowedForCreator("stories", []), true);
assert.equal(isPostTypeAllowedForCreator("mirrored_on_all_pf", []), true);
assert.equal(isPostTypeAllowedForCreator("instagram_reel", ["tiktok"]), false);

{
  const platforms = platformsFromSelectedPostTypes(["mirrored_on_all_pf"], [
    "instagram",
    "tiktok",
  ]);
  assert.deepEqual(platforms, ["instagram", "tiktok"]);
}

assert.equal(postTypePlatformKey("mirrored_ig"), "instagram");
assert.equal(postTypePlatformKey("mirrored_tt"), "tiktok");
assert.equal(postTypePlatformKey("mirrored_fb"), "facebook");
assert.equal(postTypePlatformKey("mirrored_yt"), "youtube");
assert.equal(postTypePlatformKey("yt_short"), "youtube");
assert.equal(postTypePlatformKey("yt_live"), "youtube");
assert.equal(postTypePlatformKey("yt_video"), "youtube");
assert.equal(quotationPostTypeLabel("yt_short"), "YT Short");
assert.equal(isPostTypeAllowedForCreator("yt_video", ["youtube"]), true);
assert.equal(isPostTypeAllowedForCreator("yt_video", ["instagram"]), false);
assert.equal(isPostTypeAllowedForCreator("facebook_post", ["facebook"]), true);
assert.equal(isPostTypeAllowedForCreator("facebook_post", ["instagram", "tiktok"]), false);
assert.equal(isPostTypeAllowedForCreator("facebook_reel", ["fb"]), true);
assert.equal(isPostTypeAllowedForCreator("mirrored_ig", ["instagram"]), true);
assert.equal(isPostTypeAllowedForCreator("mirrored_ig", ["tiktok"]), false);
assert.equal(isPostTypeAllowedForCreator("mirrored_yt", ["youtube"]), true);
assert.equal(isPostTypeAllowedForCreator("mirrored_yt", ["instagram"]), false);
assert.equal(quotationPostTypeLabel("mirrored_tt"), "Mirrored TT");
assert.equal(quotationPostTypeLabel("mirrored_yt"), "Mirrored YT");

assert.equal(isPostTypeAllowedForCreator("all_platforms", []), true);
assert.equal(typeLinesIncludeAllPlatforms({ type_lines: [{ type: "all_platforms", quantity: 1 }] }), true);
assert.equal(
  typeLinesIncludeAllPlatforms({ type_lines: [{ type: "instagram_reel", quantity: 1 }] }),
  false
);

{
  const synced = syncDeliverableFromTypeLines(
    [
      { type: "instagram_reel", quantity: 1 },
      { type: "", quantity: 1 },
    ],
    ["instagram"]
  );
  assert.equal(synced.type_lines.length, 2);
  assert.equal(synced.type_lines[1]?.type, "");
}

{
  const summary = formatQuotationDeliverablesSummary([
    {
      platform: "instagram",
      type: "instagram_reel",
      type_lines: [
        { type: "instagram_reel", quantity: 1 },
        { type: "instagram_story", quantity: 2 },
      ],
      quantity: 3,
      revenue: 1000,
    },
  ]);
  assert.match(summary, /1× IG Reel \+ 2× IG Story/);
}

{
  const lines = typeLinesFromSelectedTypes(
    ["instagram_reel", "instagram_story"],
    [{ type: "instagram_reel", quantity: 3 }]
  );
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.type, "instagram_reel");
  assert.equal(lines[0]?.quantity, 3);
  assert.equal(lines[1]?.type, "instagram_story");
  assert.equal(lines[1]?.quantity, 1);
}

{
  const types = selectedTypesFromTypeLines([
    { type: "yt_short", quantity: 2 },
    { type: "yt_video", quantity: 1 },
  ]);
  assert.deepEqual(types, ["yt_short", "yt_video"]);
}

{
  const synced = syncDeliverableFromTypeLines(
    [
      { type: "yt_short", quantity: 1 },
      { type: "yt_live", quantity: 1 },
    ],
    ["youtube"]
  );
  assert.equal(synced.platform, "youtube");
  assert.equal(synced.types.join(","), "yt_short,yt_live");
}

console.log("quotation-deliverable-types.test.ts — all tests passed");
