import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  canonicalPlatformLabel,
  mergePlatformAllocation,
} from "@/features/campaign-outputs/platform-allocation";
import { buildPlatformAllocationFromQuotation } from "@/features/campaign-outputs/media-plan-operations";
import { expandRawSchedulableDeliverables } from "@/features/campaign-outputs/media-plan-scheduler";
import { sortedPlatforms } from "@/features/campaign-outputs/media-plan-strategy-narrative";
import type { SlateCreator } from "@/features/campaign-outputs/output-inputs";

test("mergePlatformAllocation combines TikTok and tiktok into one label", () => {
  const merged = mergePlatformAllocation({ TikTok: 7, tiktok: 5, Instagram: 3 });
  assert.equal(merged.TikTok, 12);
  assert.equal(merged.Instagram, 3);
  assert.equal(merged.tiktok, undefined);
});

test("canonicalPlatformLabel normalizes lowercase quotation platform values", () => {
  assert.equal(canonicalPlatformLabel("tiktok"), "TikTok");
  assert.equal(canonicalPlatformLabel("instagram"), "Instagram");
});

test("buildPlatformAllocationFromQuotation counts mirrored cross-post platforms", () => {
  const creator = {
    creatorId: "c1",
    displayName: "Creator",
    tier: "Macro",
    platform: "Instagram",
    serviceTypes: ["1× IG Reel", "1× Mirrored FB", "1× Mirrored YT"],
  } satisfies SlateCreator;

  const allocation = buildPlatformAllocationFromQuotation(
    [creator],
    ["Instagram"],
    expandRawSchedulableDeliverables
  );

  assert.equal(allocation.Instagram, 1);
  assert.equal(allocation.Facebook, 1);
  assert.equal(allocation.YouTube, 1);
});

test("sortedPlatforms returns a single TikTok row for mixed-case allocation", () => {
  const ranked = sortedPlatforms({ TikTok: 7, tiktok: 3, Instagram: 2 });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]!.platform, "TikTok");
  assert.equal(ranked[0]!.count, 10);
  assert.equal(ranked[0]!.percentage, 83);
});
