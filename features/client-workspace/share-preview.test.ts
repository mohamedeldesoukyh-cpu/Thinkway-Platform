import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignShareMetadata, shareImagePath } from "./share-preview";

test("campaign title is absolute and the preview contains only public presentation content", () => {
  const metadata = campaignShareMetadata({ campaignName: "Arab Bank Cross Border Influencers Campaign", reviewId: "review-a", token: "signed value&?", origin: "https://app.thinkwaymedia.com", version: "2026-09-22" });
  assert.deepEqual(metadata.title, { absolute: "Arab Bank Cross Border Influencers Campaign" });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  const image = (metadata.openGraph?.images as { url: string }[])[0];
  const url = new URL(image.url);
  assert.equal(url.origin, "https://app.thinkwaymedia.com");
  assert.equal(url.searchParams.get("sign"), "signed value&?");
  assert.equal(url.searchParams.get("reviewId"), "review-a");
  assert.equal(url.searchParams.get("v"), "2026-09-22");
  assert.ok(!metadata.description?.includes("signed"));
  assert.equal(metadata.openGraph?.title, metadata.twitter?.title);
});

test("cover changes get a new image URL and blank names have a usable title", () => {
  assert.notEqual(shareImagePath("a", "token", "1"), shareImagePath("a", "token", "2"));
  const metadata = campaignShareMetadata({ campaignName: "  ", reviewId: "a", token: "token", origin: "https://dev.thinkwaymedia.com" });
  assert.deepEqual(metadata.title, { absolute: "Your campaign · Thinkway" });
});
