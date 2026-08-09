import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MIX_BANNER_MM,
  MIX_PAGE_BUDGET_MM,
  MIX_PAGE_HEAD_MM,
  MIX_ROW_MM,
  MIX_TIER_HEADER_MM,
  paginateMixTiers,
  type MixTierInput,
} from "./quotation-template-pagination";

function tier(
  name: string,
  creatorCount: number,
  platformsPerCreator = 2
): MixTierInput {
  return {
    name,
    slug: name.toLowerCase(),
    meta: `${creatorCount} creators`,
    creators: Array.from({ length: creatorCount }, (_, i) => ({
      handle: `@c${i}`,
      category: "Lifestyle",
      fee: "1000",
      platforms: Array.from({ length: platformsPerCreator }, (_, p) => ({
        platform: p === 0 ? "instagram" : "tiktok",
        followers: "1M",
        views: "10K",
        engagement: "1%",
      })),
    })),
  };
}

test("paginateMixTiers never splits a creator across pages", () => {
  const pages = paginateMixTiers([tier("MEGA", 8), tier("MACRO", 3)], {
    includeBanner: true,
  });
  assert.ok(pages.length >= 2);
  for (const page of pages) {
    for (const slice of page.tiers) {
      for (const creator of slice.creators) {
        assert.equal(creator.platforms.length, 2);
      }
    }
  }
});

test("paginateMixTiers re-emits continued tier headers", () => {
  // Force overflow with many creators.
  const pages = paginateMixTiers([tier("MID", 20)], { includeBanner: true });
  assert.ok(pages.length >= 2);
  assert.equal(pages[0]?.continued, false);
  assert.equal(pages[1]?.continued, true);
  assert.ok(pages.some((page) => page.tiers.some((slice) => slice.continued)));
});

test("paginateMixTiers keeps banner on the last page only", () => {
  const pages = paginateMixTiers([tier("MEGA", 8), tier("MICRO", 2)], {
    includeBanner: true,
  });
  assert.ok(pages.length >= 1);
  for (let i = 0; i < pages.length; i++) {
    assert.equal(pages[i]!.showBanner, i === pages.length - 1);
  }
});

test("budget constants leave room for header + rows + banner", () => {
  const oneCreator = MIX_TIER_HEADER_MM + 2 * MIX_ROW_MM;
  assert.ok(MIX_PAGE_HEAD_MM + oneCreator + MIX_BANNER_MM <= MIX_PAGE_BUDGET_MM);
});
