import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewPlatformBreakdown } from "./components/review-platform-breakdown";
import { clientPlatformTier } from "./platform-breakdown";

test("each account gets its own tier instead of an aggregate creator tier", () => {
  for (const variant of ["list", "detail"] as const) {
    const html = renderToStaticMarkup(<ReviewPlatformBreakdown variant={variant} rows={[
      { platform: "instagram", followers: 1_200_000, lines: [] },
      { platform: "tiktok", followers: 45_000, lines: [] },
    ]} />);
    assert.match(html, /Instagram tier: Mega/);
    assert.match(html, /TikTok tier: Micro/);
  }
});

test("missing follower counts do not invent a tier", () => {
  for (const followers of [undefined, null, 0, -1, NaN, Infinity]) {
    assert.equal(clientPlatformTier(followers), null);
  }
});

test("platform tiers use the shared classification boundaries", () => {
  assert.equal(clientPlatformTier(9_999), "Nano");
  assert.equal(clientPlatformTier(10_000), "Micro");
  assert.equal(clientPlatformTier(100_000), "Mid");
  assert.equal(clientPlatformTier(500_000), "Macro");
  assert.equal(clientPlatformTier(1_000_000), "Mega");
  assert.equal(clientPlatformTier(5_000_000), "Celebrity");
  assert.equal(clientPlatformTier(539_003), "Macro");
  assert.equal(clientPlatformTier(451_200), "Mid");
});
