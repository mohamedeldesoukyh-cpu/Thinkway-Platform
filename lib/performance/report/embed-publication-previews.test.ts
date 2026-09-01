import assert from "node:assert/strict";
import test from "node:test";

import {
  embedCampaignPublicationPreview,
  toUnprocessedImageDataUri,
} from "@/lib/performance/report/embed-publication-previews";

test("already-embedded JPEG data URIs are left untouched", async () => {
  const stored =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD";
  const out = await embedCampaignPublicationPreview({
    screenshot_url: stored,
    content_url: "https://www.instagram.com/p/abc/",
  });
  assert.equal(out, stored);
});

test("toUnprocessedImageDataUri wraps original bytes without re-encoding", () => {
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const uri = toUnprocessedImageDataUri(buffer, "image/jpeg");
  assert.equal(uri, `data:image/jpeg;base64,${buffer.toString("base64")}`);
});

test("content-type parameters are stripped from the data URI", () => {
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const uri = toUnprocessedImageDataUri(buffer, "image/png; charset=binary");
  assert.ok(uri.startsWith("data:image/png;base64,"));
  assert.ok(!uri.includes("charset"));
});
