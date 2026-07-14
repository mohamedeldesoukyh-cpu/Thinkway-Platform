import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { classifyCreatorForCleanup, type CreatorReferences } from "./cleanup-classification";

const NO_REFS: CreatorReferences = {
  campaignUsage: false,
  shortlistReferences: false,
  quotationReferences: false,
  portalOrDocuments: false,
};

function emptyCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:empty-1",
    source_type: "internal",
    influencer_id: "empty-1",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Empty Creator",
    status: "active",
    country_code: null,
    estimated_country: null,
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {} as UnifiedCreatorResult["metrics"],
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 0,
    source_confidence: 0,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    ...overrides,
  } as UnifiedCreatorResult;
}

function run(): void {
  // Fully empty + unreferenced → safe_archive with zero keep reasons.
  const safe = classifyCreatorForCleanup(emptyCreator(), NO_REFS);
  assert.equal(safe.verdict, "safe_archive");
  assert.deepEqual(safe.keepReasons, []);

  // Each dimension independently forces must_keep with the right reason.
  const cases: Array<[Partial<UnifiedCreatorResult>, string]> = [
    [{ dna_completeness: 40 }, "has_creator_dna"],
    [{ ai_category: "Beauty" }, "has_ai_score"],
    [{ bio: "hello" }, "has_bio"],
    [{ audience_interests: ["fitness"] }, "has_audience_interests"],
    [
      {
        recent_publications: [
          { url: null, thumbnail: null, likes: null, comments: null, views: null, posted_at: null, caption: "hi" },
        ],
      },
      "has_captions",
    ],
    [{ hashtags: ["#x"] }, "has_profile_signals"],
    [{ categories: ["Beauty"] }, "has_stored_categories"],
    [
      { platforms: [{ platform: "tiktok", follower_count: 10 } as UnifiedCreatorResult["platforms"][number]] },
      "has_platform_metrics",
    ],
    [{ notes: "VIP" }, "has_manual_notes"],
    [{ primaryAvatarSource: "uploaded" }, "has_manual_avatar"],
    [
      {
        // Internal creators surface manual overrides as confidence "verified".
        metrics: { followers: { value: 5000, confidence: "verified" } } as UnifiedCreatorResult["metrics"],
      },
      "has_manual_metric_override",
    ],
  ];
  for (const [overrides, reason] of cases) {
    const verdict = classifyCreatorForCleanup(emptyCreator(overrides), NO_REFS);
    assert.equal(verdict.verdict, "must_keep", reason);
    assert.ok(verdict.keepReasons.includes(reason), `expected ${reason}, got ${verdict.keepReasons}`);
  }

  // References force must_keep even when the profile itself is empty.
  const referenced = classifyCreatorForCleanup(emptyCreator(), {
    ...NO_REFS,
    campaignUsage: true,
  });
  assert.equal(referenced.verdict, "must_keep");
  assert.ok(referenced.keepReasons.includes("referenced_by_campaigns"));

  // Provenance tags on a discovered profile are NOT a keep reason (crawl intent).
  const provenance = classifyCreatorForCleanup(
    emptyCreator({
      unified_id: "dis:p1",
      source_type: "public_discovery",
      influencer_id: null,
      discovered_profile_id: "p1",
      categories: ["Lifestyle"],
      browse_category_tags: ["Lifestyle"],
    }),
    NO_REFS
  );
  assert.equal(provenance.verdict, "safe_archive");

  console.log("cleanup-classification.test.ts: PASS");
}

run();
