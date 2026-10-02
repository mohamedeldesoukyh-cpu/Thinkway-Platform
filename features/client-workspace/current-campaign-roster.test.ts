import assert from "node:assert/strict";
import test from "node:test";
import { currentCampaignCreators, type CurrentCampaignLine } from "./current-campaign-roster";
import { applyLiveCreatorProfile } from "./creator-snapshot";
import { briefFromSnapshotCreator } from "./creator-brief";
import { reviewMediaAllowlist, isReviewMediaUrlAllowed } from "./review-media";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import type { ClientReviewSourceSnapshot } from "./types";

const line = (id: string, status = "draft", revenue = 55000): CurrentCampaignLine => ({
  id, status, name: id, description: "1× IG Reel + 1× Boosting", platform: "instagram",
  revenue, revenue_base: revenue, currency_code: "EGP", influencerId: id, displayName: id,
});

test("replacement removes cancelled identity without changing the approved snapshot", () => {
  const original = [{ creatorId: "inf:old", influencerId: "old", displayName: "thetinytoffee", profileUrl: "https://instagram.com/thetinytoffee", investmentAmount: 55000 }];
  const before = JSON.stringify(original);
  const creators = currentCampaignCreators(original, [line("old", "cancelled"), line("toffee.tiny")], "EGP", 1);
  assert.equal(creators.length, 1);
  assert.equal(creators[0].displayName, "toffee.tiny");
  assert.equal(creators[0].investmentAmount, 55000);
  assert.equal(creators[0].profileUrl, undefined);
  assert.equal(creators[0].serviceDescription, "1× IG Reel + 1× Boosting");
  assert.equal(JSON.stringify(original), before);
});

test("active assignments aggregate by creator and retain matching profile identity", () => {
  const creators = currentCampaignCreators([{ creatorId: "profile:one", influencerId: "one", displayName: "One", avatarUrl: "one.jpg" }],
    [line("one", "draft", 50), { ...line("one", "draft", 30), id: "second" }], "EGP", 1);
  assert.equal(creators.length, 1);
  assert.equal(creators[0].creatorId, "profile:one");
  assert.equal(creators[0].avatarUrl, "one.jpg");
  assert.equal(creators[0].investmentAmount, 80);
});

test("empty active roster stays empty and cross currency uses base revenue", () => {
  assert.deepEqual(currentCampaignCreators([], [line("old", "cancelled")], "EGP", 1), []);
  const creators = currentCampaignCreators([], [{ ...line("one"), revenue_base: 50000 }], "USD", 50);
  assert.equal(creators[0].investmentAmount, 1000);
  assert.equal(creators[0].investmentCurrency, "USD");
});

test("replacement profile details and publications follow the same identity into the review", () => {
  const [replacement] = currentCampaignCreators([], [line("new")], "EGP", 1);
  const url = "https://www.instagram.com/new/";
  const post = "https://www.instagram.com/p/newpost/";
  const avatar = "https://images.example/new.jpg";
  const creator = applyLiveCreatorProfile(replacement, {
    unified_id: "inf:new", influencer_id: "new", display_name: "New creator",
    bio: "Creator biography", categories: ["Lifestyle"], primaryAvatarUrl: avatar,
    metrics: Object.fromEntries(["followers", "engagement_rate", "avg_likes", "avg_comments", "avg_views"].map(key => [key, { value: null }])),
    platforms: [{ id: "ig", platform: "instagram", handle: "new", profile_url: url,
      recent_publications: [{ url: post, thumbnail_url: "https://images.example/post.jpg" }] }],
  } as unknown as UnifiedCreatorResult);
  const brief = briefFromSnapshotCreator(creator);
  assert.equal(brief.bio, "Creator biography");
  assert.equal(brief.avatarUrl, avatar);
  assert.equal(brief.contentFeed[0]?.url, post);
  assert.equal(creator.investmentAmount, 55000);
  const allow = reviewMediaAllowlist({ creators: [creator] } as ClientReviewSourceSnapshot);
  assert.equal(isReviewMediaUrlAllowed(allow, null, post, url), true);
  assert.equal(isReviewMediaUrlAllowed(allow, "https://unrelated.example/private.jpg", null, null), false);
});
