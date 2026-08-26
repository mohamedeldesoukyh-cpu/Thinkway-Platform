import assert from "node:assert/strict";
import { test } from "node:test";

import { isServerActionDecodeError } from "@/lib/clients/client-document-utils";
import {
  DELIVERABLE_ASSET_MAX_BYTES,
  DELIVERABLE_ASSET_TOO_LARGE_MESSAGE,
  inferDeliverableAssetMime,
} from "@/lib/services/deliverables/documentation-types";

test("deliverable asset size cap matches the 100 MB storage bucket", () => {
  assert.equal(DELIVERABLE_ASSET_MAX_BYTES, 100 * 1024 * 1024);
  assert.match(DELIVERABLE_ASSET_TOO_LARGE_MESSAGE, /100 MB/);
});

test("inferDeliverableAssetMime uses the file extension when the browser omits a type", () => {
  assert.equal(inferDeliverableAssetMime("video/mp4", "omar.mp4"), "video/mp4");
  assert.equal(inferDeliverableAssetMime("", "omar-reel.MOV"), "video/quicktime");
  assert.equal(inferDeliverableAssetMime(null, "draft.webm"), "video/webm");
});

test("server-action protocol errors are identified so Deliverables does not crash", () => {
  assert.equal(
    isServerActionDecodeError(
      new Error("An unexpected response was received from the server.")
    ),
    true
  );
});
