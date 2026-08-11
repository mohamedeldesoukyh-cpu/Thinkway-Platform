import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAssignmentDisplayName,
  sanitizeAssignmentCreatorName,
} from "./assignment-line-naming";

describe("sanitizeAssignmentCreatorName", () => {
  it("decodes HTML entities and strips Instagram page-title tails", () => {
    assert.equal(
      sanitizeAssignmentCreatorName(
        "&#x200e;Ali Mahgoub | &#x639;&#x644;&#x649; &#x645;&#x62d;&#x62c;&#x648;&#x628; (@ali.mahgub) • Instagram photos and videos"
      ),
      "Ali Mahgoub | على محجوب"
    );
  });
});

describe("buildAssignmentDisplayName", () => {
  it("sanitizes scraped creator titles before appending package label", () => {
    assert.equal(
      buildAssignmentDisplayName(
        "&#x200e;Ali Mahgoub | &#x639;&#x644;&#x649; &#x645;&#x62d;&#x62c;&#x648;&#x628; (@ali.mahgub) • Instagram photos and videos",
        [
          { platform: "instagram", deliverable_type: "instagram_reel", posts_count: 1 },
          { platform: "tiktok", deliverable_type: "mirrored_tt", posts_count: 1 },
        ]
      ),
      "Ali Mahgoub | على محجوب — Multi-platform package"
    );
  });
});
