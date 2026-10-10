import assert from "node:assert/strict";
import test from "node:test";
import { currentCampaignCreators, type CurrentCampaignLine } from "./current-campaign-roster";
import { applyLiveCreatorProfile } from "./creator-snapshot";
import { briefFromSnapshotCreator } from "./creator-brief";
import { reviewMediaAllowlist, isReviewMediaUrlAllowed } from "./review-media";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import type { ClientReviewSourceSnapshot } from "./types";
import { selectionCalculator } from "./selection-flow";
import { aggregateCampaignDisplayFinancials } from "@/lib/campaigns/campaign-display-financials";
import { makeCreatorFx } from "@/lib/commercial/creator-fx";

const line = (id: string, status = "draft", revenue = 55000): CurrentCampaignLine => ({
  id, status, name: id, description: "1× IG Reel + 1× Boosting", platform: "instagram",
  revenue, revenue_base: revenue, currency_code: "EGP", influencerId: id, displayName: id,
});

test("mixed USD/AED roster converts each price and AF before summing EGP", () => {
  const lines = [
    { ...line("one", "draft", 8750), currency_code: "USD", revenue_base: 8750, agency_fee_percent: 10 },
    { ...line("two", "draft", 37500), currency_code: "AED", revenue_base: 37500, agency_fee_percent: 10 },
  ];
  const rates = new Map([["USD", 55], ["AED", 15.5]]);
  const creators = currentCampaignCreators([], lines, "EGP", rates);
  assert.deepEqual(creators.map(c => [c.investmentAmount, c.agencyFeeAmount, c.investmentCurrency]),
    [[481250, 48125, "EGP"], [581250, 58125, "EGP"]]);
  const totals = selectionCalculator(creators, Object.fromEntries(creators.map(c => [c.creatorId, "accepted" as const])));
  assert.equal(totals.totalInvestment, 1168750);
  assert.equal(totals.totalInvestment, aggregateCampaignDisplayFinancials({ lines, displayCurrency: "EGP", rateToEgpByCurrency: rates }).revenue);
});

test("commercial masters, usage rights and negotiated FX match campaign amounts", () => {
  const lines = [{ ...line("one", "draft", 114), currency_code: "USD", revenue_before_vat: 100,
    usage_rights_amount: 20, agency_fee_amount: 12, agency_fee_percent: 99,
    revenue_fx_override: makeCreatorFx("USD", "EGP", 60, 1) }];
  const rates = new Map([["USD", 55], ["AED", 15]]);
  for (const currency of ["EGP", "USD", "AED"]) {
    const creators = currentCampaignCreators([], lines, currency, rates);
    const total = selectionCalculator(creators, { "inf:one": "accepted" }).totalInvestment;
    assert.equal(total, aggregateCampaignDisplayFinancials({ lines, displayCurrency: currency, rateToEgpByCurrency: rates }).revenue);
  }
  assert.equal(currentCampaignCreators([], lines, "EGP", rates)[0].investmentAmount, 6000);
});

test("missing FX never silently relabels native money as EGP", () => {
  assert.throws(() => currentCampaignCreators([], [{ ...line("one"), currency_code: "USD" }], "EGP", new Map()), /Missing FX/);
});

test("replacement removes cancelled identity without changing the approved snapshot", () => {
  const original = [{ creatorId: "inf:old", influencerId: "old", displayName: "thetinytoffee", profileUrl: "https://instagram.com/thetinytoffee", investmentAmount: 55000 }];
  const before = JSON.stringify(original);
  const creators = currentCampaignCreators(original, [line("old", "cancelled"), line("toffee.tiny")], "EGP", new Map());
  assert.equal(creators.length, 1);
  assert.equal(creators[0].displayName, "toffee.tiny");
  assert.equal(creators[0].investmentAmount, 55000);
  assert.equal(creators[0].profileUrl, undefined);
  assert.equal(creators[0].serviceDescription, "1× IG Reel + 1× Boosting");
  assert.equal(JSON.stringify(original), before);
});

test("active assignments aggregate by creator and retain matching profile identity", () => {
  const creators = currentCampaignCreators([{ creatorId: "profile:one", influencerId: "one", displayName: "One", avatarUrl: "one.jpg" }],
    [line("one", "draft", 50), { ...line("one", "draft", 30), id: "second" }], "EGP", new Map());
  assert.equal(creators.length, 1);
  assert.equal(creators[0].creatorId, "profile:one");
  assert.equal(creators[0].avatarUrl, "one.jpg");
  assert.equal(creators[0].investmentAmount, 80);
});

test("empty active roster stays empty and cross currency converts native revenue, never the legacy base", () => {
  assert.deepEqual(currentCampaignCreators([], [line("old", "cancelled")], "EGP", new Map()), []);
  const creators = currentCampaignCreators([], [{ ...line("one"), revenue_base: 50000 }], "USD", new Map([["USD", 50]]));
  assert.equal(creators[0].investmentAmount, 1100);
  assert.equal(creators[0].investmentCurrency, "USD");
});

test("replacement profile details and publications follow the same identity into the review", () => {
  const [replacement] = currentCampaignCreators([], [line("new")], "EGP", new Map());
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
