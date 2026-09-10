/**
 * Studio cards show the same creator image Discovery shows.
 *
 * Discovery resolves the avatar with `resolveUnifiedCreatorAvatarUrl`, which
 * picks the best USABLE candidate across the profile and every platform
 * account and falls back to a recent-publication thumbnail when the stored CDN
 * URL has expired — common after enrichment without a durable upload.
 *
 * The Studio hydration mapper took `primaryAvatarUrl ?? profile_image_url` and
 * returned it unchecked, so for those creators Discovery displayed a real image
 * and the Studio card displayed a dead URL the media proxy could not recover —
 * the generic placeholder. Both now use the one canonical resolver.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { creatorProfileSourceFromUnified, resolveUnifiedCreatorAvatarUrl } from "@/lib/creators/creator-profile-source";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { mapCreatorToHydratedVendor } from "./creator-hydration-mapper";

/** An expired Instagram CDN URL — the shape that produced the placeholder. */
const EXPIRED_IG =
  "https://scontent-lhr8-1.cdninstagram.com/v/t51.2885-19/x.jpg?oe=1700000000&oh=abc&_nc_ht=scontent.cdninstagram.com";
const LIVE_PUBLICATION = "https://cdn.thinkway.test/publications/live-thumb.jpg";

function creator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:1",
    source_type: "internal",
    influencer_id: "1",
    discovered_profile_id: null,
    display_name: "Creator One",
    bio: null,
    profile_image_url: null,
    primaryAvatarUrl: null,
    primaryAvatarSource: null,
    country_code: "EG",
    country_codes: ["EG"],
    estimated_country: "EG",
    categories: ["beauty"],
    platforms: [
      {
        id: "p1",
        platform: "instagram",
        handle: "creator_one",
        profile_url: "https://instagram.com/creator_one",
        follower_count: 120_000,
        engagement_rate: 3.2,
        audience_country: "EG",
        profile_picture_url: null,
        is_verified: false,
      },
    ],
    metrics: {
      followers: { value: 120_000, confidence: "verified" },
      engagement_rate: { value: 3.2, confidence: "verified" },
      avg_likes: { value: 3_000, confidence: "estimated" },
      posting_frequency_per_week: { value: 3, confidence: "estimated" },
    },
    source_confidence: 85,
    ...overrides,
  } as unknown as UnifiedCreatorResult;
}

function studioAvatar(input: UnifiedCreatorResult): string | undefined {
  return mapCreatorToHydratedVendor(input, 0, undefined, undefined, undefined).avatarUrl;
}

function discoveryAvatar(input: UnifiedCreatorResult): string | null {
  return creatorProfileSourceFromUnified(input).avatarUrl;
}

test("a plain profile avatar resolves the same in both", () => {
  const withAvatar = creator({
    primaryAvatarUrl: "https://cdn.thinkway.test/a.jpg",
  } as Partial<UnifiedCreatorResult>);

  assert.equal(studioAvatar(withAvatar), "https://cdn.thinkway.test/a.jpg");
  assert.equal(studioAvatar(withAvatar), discoveryAvatar(withAvatar));
});

test("a platform account picture resolves the same in both", () => {
  const fromPlatform = creator({
    platforms: [
      {
        id: "p1",
        platform: "instagram",
        handle: "creator_one",
        profile_url: null,
        follower_count: 120_000,
        engagement_rate: 3.2,
        audience_country: "EG",
        profile_picture_url: "https://cdn.thinkway.test/platform.jpg",
        is_verified: false,
      },
    ],
  } as Partial<UnifiedCreatorResult>);

  assert.equal(studioAvatar(fromPlatform), discoveryAvatar(fromPlatform));
  assert.equal(studioAvatar(fromPlatform), "https://cdn.thinkway.test/platform.jpg");
});

test("an expired CDN avatar resolves identically — this is the placeholder case", () => {
  const expired = creator({
    primaryAvatarUrl: EXPIRED_IG,
    recent_publications: [
      { thumbnail_url: LIVE_PUBLICATION, post_url: "https://instagram.com/p/abc" },
    ],
  } as unknown as Partial<UnifiedCreatorResult>);

  assert.equal(
    studioAvatar(expired),
    discoveryAvatar(expired) ?? undefined,
    "Studio must not diverge from Discovery on an expired CDN URL"
  );
});

test("Studio and Discovery agree for a creator with no image at all", () => {
  const bare = creator();
  assert.equal(studioAvatar(bare) ?? null, discoveryAvatar(bare));
});

test("the Studio mapper calls the canonical resolver", () => {
  // Contract: one mapping. A future edit that reintroduces a local
  // `primaryAvatarUrl ?? profile_image_url` shortcut fails here.
  const source = require("node:fs").readFileSync(
    "features/campaign-studio/services/creator-hydration-mapper.ts",
    "utf8"
  ) as string;

  assert.match(source, /resolveUnifiedCreatorAvatarUrl\(creator\)/);
  assert.ok(
    !/creator\.primaryAvatarUrl \?\? creator\.profile_image_url/.test(source),
    "the unchecked shortcut must not come back"
  );
});

test("the canonical resolver is the one Discovery's view model uses", () => {
  const profileSource = require("node:fs").readFileSync(
    "lib/creators/creator-profile-source.ts",
    "utf8"
  ) as string;
  assert.match(profileSource, /export function resolveUnifiedCreatorAvatarUrl/);
  assert.equal(typeof resolveUnifiedCreatorAvatarUrl, "function");
});
