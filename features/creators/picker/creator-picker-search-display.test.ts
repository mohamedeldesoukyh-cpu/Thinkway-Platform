import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { resolveCreatorPickerSearchDisplay } from "./creator-picker-search-display";

function makeCreator(
  partial: Partial<UnifiedCreatorResult> & Pick<UnifiedCreatorResult, "unified_id" | "display_name">
): UnifiedCreatorResult {
  return {
    source_type: "imported",
    influencer_id: partial.unified_id.replace("inf:", ""),
    discovered_profile_id: null,
    document_number: "TW-TEST-1",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    metrics: {
      followers: { value: 1000, confidence: "verified" },
      engagement_rate: { value: 1.2, confidence: "verified" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    platforms: [],
    enrichment_status: null,
    ...partial,
    display_name: partial.display_name,
    unified_id: partial.unified_id,
  };
}

test("handle-like query with only fuzzy hits shows add-missing empty state", () => {
  const fuzzyOnly = [
    makeCreator({
      unified_id: "inf:other",
      display_name: "Fatma Usama",
      platforms: [
        {
          platform: "instagram",
          handle: "@fatmausamakholef",
          profile_url: "https://instagram.com/fatmausamakholef",
          follower_count: 203000,
          is_primary: true,
        },
      ],
    }),
  ];

  const display = resolveCreatorPickerSearchDisplay("tasneemmohamedd00", fuzzyOnly, {
    loading: false,
    browseTotal: 1,
  });

  assert.equal(display.isExactCreatorSearch, true);
  assert.equal(display.exactCreatorZeroMatch, true);
  assert.equal(display.creators.length, 0);
  assert.equal(display.total, 0);
});

test("handle-like query keeps exact handle match", () => {
  const creators = [
    makeCreator({
      unified_id: "inf:match",
      display_name: "Tasneem",
      platforms: [
        {
          platform: "instagram",
          handle: "@tasneemmohamedd00",
          profile_url: "https://instagram.com/tasneemmohamedd00",
          follower_count: 50000,
          is_primary: true,
        },
      ],
    }),
    makeCreator({
      unified_id: "inf:other",
      display_name: "Fatma Usama",
      platforms: [
        {
          platform: "instagram",
          handle: "@fatmausamakholef",
          profile_url: "https://instagram.com/fatmausamakholef",
          follower_count: 203000,
          is_primary: true,
        },
      ],
    }),
  ];

  const display = resolveCreatorPickerSearchDisplay("tasneemmohamedd00", creators, {
    loading: false,
    browseTotal: 2,
  });

  assert.equal(display.creators.length, 1);
  assert.equal(display.creators[0]?.unified_id, "inf:match");
  assert.equal(display.exactCreatorZeroMatch, false);
});

test("category discovery query keeps fuzzy browse results", () => {
  const creators = [
    makeCreator({
      unified_id: "inf:1",
      display_name: "Travel Creator",
    }),
  ];

  const display = resolveCreatorPickerSearchDisplay("travel bloggers egypt", creators, {
    loading: false,
    browseTotal: 1,
  });

  assert.equal(display.isExactCreatorSearch, false);
  assert.equal(display.creators.length, 1);
});
