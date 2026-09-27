import assert from "node:assert/strict";
import { test } from "node:test";

import {
  needsWorkspaceAvatarStabilize,
  pickBestDisplayableAvatarUrl,
} from "@/lib/services/quotations/enrich-quotation-item-avatars";
import { pickBestQuotationSeedAvatarUrl } from "@/lib/commercial-sync/shortlist-seeds";

const importCrop =
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/abc/instagram/zeinaelfakahany.jpg";
const enrichmentPhoto =
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/f2f688c2-5d47-4b07-b34f-7b1ee2ca44f6/instagram/zeinaelfakahany.jpg";
const expiredIgCdn =
  "https://scontent.cdninstagram.com/v/t51.2885-19/x.jpg?oe=60000000";
const freshIgCdn =
  "https://scontent.cdninstagram.com/v/t51.2885-19/x.jpg?oe=FFFFFFFF";

test("quotation workspace avatar pick prefers enrichment over import primary", () => {
  const resolved = pickBestDisplayableAvatarUrl(importCrop, enrichmentPhoto);
  assert.equal(resolved, enrichmentPhoto);
});

test("quotation workspace avatar pick keeps enrichment when primary is listed first", () => {
  assert.equal(
    pickBestDisplayableAvatarUrl(importCrop, null, enrichmentPhoto),
    enrichmentPhoto
  );
});

test("quotation seed avatar pick prefers durable storage over expired Instagram CDN", () => {
  assert.equal(
    pickBestQuotationSeedAvatarUrl(expiredIgCdn, enrichmentPhoto),
    enrichmentPhoto
  );
  assert.equal(
    pickBestQuotationSeedAvatarUrl(expiredIgCdn, null, importCrop),
    importCrop
  );
});

test("workspace stabilize needed for CDN/null but not durable storage", () => {
  assert.equal(needsWorkspaceAvatarStabilize(null), true);
  assert.equal(needsWorkspaceAvatarStabilize(expiredIgCdn), true);
  assert.equal(needsWorkspaceAvatarStabilize(freshIgCdn), true);
  assert.equal(needsWorkspaceAvatarStabilize(enrichmentPhoto), false);
});
import { buildQuotationSeedFromCreator } from "@/lib/commercial-sync/shortlist-seeds";
import { resolveLineAvatarFields } from "./enrich-quotation-item-avatars";
import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

test("quotation import and platform rows use the same avatar and each platform's own metrics", () => {
  const creator = {
    unified_id: "inf:fixture", influencer_id: "fixture", source: "internal", display_name: "Fixture Creator",
    profile_image_url: enrichmentPhoto, primaryAvatarUrl: enrichmentPhoto,
    default_metrics_platform_account_id: "ig", enrichment_status: "enriched", categories: [],
    country_code: "EG", country_codes: ["EG"], recent_publications: [],
    metrics: { followers: { value: 999 }, engagement_rate: { value: 99 }, avg_views: { value: 999 } },
    platforms: [
      { id: "ig", platform: "instagram", handle: "fixture", profile_picture_url: enrichmentPhoto, follower_count: 1000, engagement_rate: 3, avg_views: 500, recent_publications: [] },
      { id: "tt", platform: "tiktok", handle: "fixture", follower_count: 2000, engagement_rate: 7, avg_views: 900, recent_publications: [] },
    ],
  } as unknown as UnifiedCreatorResult;
  const seed = buildQuotationSeedFromCreator(creator);
  assert.equal(seed.followers, 1000);
  assert.equal(seed.engagement_rate, 3);
  assert.equal(seed.profile_image_url, creatorProfileSourceFromUnified(creator).avatarUrl);
  for (const [platform, followers, er, views] of [["instagram", 1000, 3, 500], ["tiktok", 2000, 7, 900]] as const) {
    const fields = resolveLineAvatarFields({ platform, followers: null, engagement_rate: null } as QuotationItemRow, creator, undefined);
    assert.equal(fields.followers, followers);
    assert.equal(fields.engagement_rate, er);
    assert.equal(fields.avg_views, views);
    assert.equal(fields.profile_image_url, seed.profile_image_url);
  }
});
