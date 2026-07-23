import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { slimRecentPublicationsForBrowse } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { metricWithConfidence } from "@/lib/creators/confidence";

function baseCreator(
  overrides: Partial<UnifiedCreatorResult> = {}
): UnifiedCreatorResult {
  return {
    unified_id: "inf:test",
    source_type: "internal",
    influencer_id: "test",
    discovered_profile_id: null,
    document_number: "TW-2026-0001",
    display_name: "Test Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    browse_category_tags: [],
    audience_interests: ["Beauty & Cosmetics"],
    audience_demographics: null,
    language_codes: [],
    profile_image_url: "https://cdn.example/avatar.jpg",
    primaryAvatarUrl: "https://cdn.example/avatar.jpg",
    primaryAvatarSource: "imported",
    default_metrics_platform_account_id: "pa-1",
    bio: "Beauty creator in Cairo",
    hashtags: [],
    mentions: [],
    contact_email: null,
    contact_phone: null,
    contact_links: null,
    role: null,
    metrics: {
      followers: metricWithConfidence(120_000, "verified"),
      engagement_rate: metricWithConfidence(0.04, "verified"),
      avg_likes: metricWithConfidence(1000, "verified"),
      avg_comments: metricWithConfidence(50, "verified"),
      avg_views: metricWithConfidence(null, "estimated"),
      posting_frequency_per_week: metricWithConfidence(null, "estimated"),
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 72,
    source_confidence: 0.9,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [
      {
        id: "pa-1",
        platform: "instagram",
        handle: "testcreator",
        profile_url: "https://instagram.com/testcreator",
        follower_count: 120_000,
        engagement_rate: 0.04,
        audience_country: "EG",
        is_verified: false,
        profile_picture_url: "https://cdn.example/avatar.jpg",
        recent_publications: [
          {
            url: "https://instagram.com/p/platform-only",
            thumbnail: "https://cdn.example/platform-thumb.jpg",
            likes: 99,
            comments: 1,
            views: null,
            posted_at: null,
            caption: "heavy platform caption",
            isVideo: false,
          },
        ],
      },
    ],
    notes: null,
    suggested_currency: "EGP",
    enrichment_status: "enriched",
    last_enriched_at: "2026-07-01T00:00:00.000Z",
    enrichment_source: null,
    recent_publications: [],
    search_rank: null,
    ...overrides,
  };
}

/** Extract the omitHeavyFields === true platform-account SELECT string only. */
function omitHeavyFieldsTrueAccountSelect(source: string): string {
  const match = source.match(
    /const accountSelect = omitHeavyFields\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/
  );
  assert.ok(
    match?.[1],
    "expected accountSelect ternary for omitHeavyFields in unified-browse.ts"
  );
  return match[1]!;
}

const source = fs.readFileSync(
  path.join(process.cwd(), "lib/creators/unified-browse.ts"),
  "utf8"
);

const omitTrueSelect = omitHeavyFieldsTrueAccountSelect(source);
assert.ok(
  omitTrueSelect.includes("recent_publications"),
  "omitHeavyFields=true platform-account select must include recent_publications for Search feed preview"
);
assert.ok(
  !omitTrueSelect.includes("profile_bio"),
  "omitHeavyFields=true must not restore full bio/contact projection"
);
assert.ok(
  !omitTrueSelect.includes("contact_email"),
  "omitHeavyFields=true must not restore contact fields"
);

const withPublications = baseCreator({
  recent_publications: [
    {
      url: "https://instagram.com/p/1",
      thumbnail: "https://cdn.example/thumb1.jpg",
      likes: 10,
      comments: 2,
      views: 100,
      posted_at: "2026-01-01",
      caption: "full caption must be stripped on browse",
      isVideo: false,
    },
    {
      url: "https://instagram.com/p/2",
      thumbnail: "https://cdn.example/thumb2.jpg",
      likes: null,
      comments: null,
      views: null,
      posted_at: null,
      caption: null,
      isVideo: true,
    },
    {
      url: "https://instagram.com/p/3",
      thumbnail: "https://cdn.example/thumb3.jpg",
      likes: null,
      comments: null,
      views: null,
      posted_at: null,
      caption: null,
      isVideo: false,
    },
    {
      url: "https://instagram.com/p/4",
      thumbnail: "https://cdn.example/thumb4.jpg",
      likes: null,
      comments: null,
      views: null,
      posted_at: null,
      caption: null,
      isVideo: false,
    },
  ],
});

const slimmed = slimRecentPublicationsForBrowse([withPublications])[0]!;
assert.equal(slimmed.recent_publications?.length, 3, "browse feed capped at 3");
assert.equal(slimmed.recent_publications?.[0]?.thumbnail, "https://cdn.example/thumb1.jpg");
assert.equal(slimmed.recent_publications?.[0]?.caption, null, "browse omits caption payload");
assert.equal(slimmed.recent_publications?.[0]?.likes, null, "browse omits metric payload");
assert.equal(slimmed.recent_publications?.[1]?.isVideo, true);
assert.equal(
  slimmed.platforms[0]?.recent_publications,
  undefined,
  "platform-level publications are stripped from browse payload"
);

const fromPlatformOnly = slimRecentPublicationsForBrowse([baseCreator()])[0]!;
assert.equal(fromPlatformOnly.recent_publications?.length, 1);
assert.equal(
  fromPlatformOnly.recent_publications?.[0]?.thumbnail,
  "https://cdn.example/platform-thumb.jpg"
);
assert.equal(fromPlatformOnly.recent_publications?.[0]?.caption, null);

const emptyWhenOmitted = slimRecentPublicationsForBrowse([
  baseCreator({ recent_publications: [], platforms: [{ ...baseCreator().platforms[0]!, recent_publications: [] }] }),
])[0]!;
assert.deepEqual(emptyWhenOmitted.recent_publications, []);

console.log("lib/creators/unified-browse-browse-hydration.test.ts — all tests passed");
