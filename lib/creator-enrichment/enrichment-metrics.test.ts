import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  creatorHasDisplayableMetrics,
  enrichmentUpdatedMeaningfulFields,
  resolveEnrichmentDisplayStatus,
} from "./enrichment-metrics";

function makeCreator(
  partial: Partial<UnifiedCreatorResult>
): Pick<UnifiedCreatorResult, "metrics" | "platforms"> {
  return {
    metrics: {
      followers: { value: null, confidence: "estimated" },
      engagement_rate: { value: null, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
      ...partial.metrics,
    },
    platforms: partial.platforms ?? [],
  };
}

test("enrichmentUpdatedMeaningfulFields ignores category-only updates", () => {
  assert.equal(enrichmentUpdatedMeaningfulFields(["instagram.interest_categories"]), false);
  assert.equal(enrichmentUpdatedMeaningfulFields(["instagram.follower_count"]), true);
});

test("resolveEnrichmentDisplayStatus downgrades enriched rows without metrics", () => {
  const creator = makeCreator({
    platforms: [{ platform: "instagram", handle: "@hebanagi5", follower_count: 0 }],
  });
  assert.equal(resolveEnrichmentDisplayStatus("enriched", creator), "never");
});

test("creatorHasDisplayableMetrics detects platform followers", () => {
  const creator = makeCreator({
    platforms: [{ platform: "instagram", handle: "@x", follower_count: 1200 }],
  });
  assert.equal(creatorHasDisplayableMetrics(creator), true);
});
