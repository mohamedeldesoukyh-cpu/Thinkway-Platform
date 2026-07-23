import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  resolvePlatformBarBackground,
  resolvePlatformBarSolidColor,
} from "@/features/campaign-outputs/platform-brand";

test("platform colors are assigned per platform key", () => {
  assert.match(resolvePlatformBarBackground("Instagram"), /gradient|#E4405F|#DD2A7B|#F58529/i);
  assert.equal(resolvePlatformBarSolidColor("TikTok"), "#010101");
  assert.equal(resolvePlatformBarSolidColor("Facebook"), "#1877F2");
  assert.equal(resolvePlatformBarSolidColor("YouTube"), "#FF0000");
  assert.notEqual(
    resolvePlatformBarSolidColor("Instagram"),
    resolvePlatformBarSolidColor("TikTok")
  );
});
