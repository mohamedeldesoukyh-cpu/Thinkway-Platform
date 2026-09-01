import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { contentFormatFamily } from "./content-format";
import { allocateCreatorPostFee } from "./fees";
import { detectPostPerformanceAnalyses } from "./post-performance";
import type { CreatorPublicationObservation } from "./observations";

const CREATOR_A = "creator-a";

function obs(
  overrides: Partial<CreatorPublicationObservation> & { id: string }
): CreatorPublicationObservation {
  const publicationType = overrides.publicationType ?? "instagram_reel";
  return {
    influencerId: CREATOR_A,
    campaignHeaderId: "camp-1",
    assignmentDeliverableId: `ad-${overrides.id}`,
    assignmentPostScheduleId: null,
    platform: "instagram",
    publicationType,
    formatFamily: contentFormatFamily(publicationType),
    contentUrl: `https://instagram.com/reel/${overrides.id}`,
    publishedAt: "2026-08-20",
    status: "published",
    updatedAt: "2026-08-20T00:00:00.000Z",
    source: "thinkway_publication",
    matchStatus: null,
    views: null,
    reach: null,
    impressions: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    engagementRate: null,
    followers: null,
    ...overrides,
    formatFamily: contentFormatFamily(
      overrides.publicationType ?? publicationType,
      undefined
    ),
  };
}

describe("allocateCreatorPostFee", () => {
  it("splits the agreed campaign fee across contracted posts", () => {
    assert.equal(allocateCreatorPostFee(4000, 4), 1000);
    assert.equal(allocateCreatorPostFee(0, 4), null);
    assert.equal(allocateCreatorPostFee(null, 4), null);
  });
});

describe("detectPostPerformanceAnalyses", () => {
  it("advises when a reel beats the creator average against the agreed fee", () => {
    const rows = [
      obs({ id: "hero", views: 40000, publishedAt: "2026-08-28" }),
      obs({ id: "a", views: 10000, publishedAt: "2026-08-10" }),
      obs({ id: "b", views: 10000, publishedAt: "2026-08-12" }),
      obs({ id: "c", views: 10000, publishedAt: "2026-08-14" }),
    ];
    const analyses = detectPostPerformanceAnalyses(rows, [
      {
        campaignHeaderId: "camp-1",
        assignmentDeliverableId: "ad-hero",
        contractedSlots: 4,
        agreedFee: 4000,
        currency: "AED",
      },
    ]);
    const hero = analyses.find((row) => row.publicationId === "hero");
    assert.ok(hero);
    assert.equal(hero.verdict, "strong");
    assert.equal(hero.feeAmount, 1000);
    assert.match(hero.feeLabel ?? "", /AED/);
    assert.match(hero.explanation, /agreed/);
    assert.match(hero.advice, /agreed fee is working/i);
  });

  it("tells the creator when a paid post is below their usual", () => {
    const rows = [
      obs({ id: "weak", views: 2000, publishedAt: "2026-08-28" }),
      obs({ id: "a", views: 12000, publishedAt: "2026-08-10" }),
      obs({ id: "b", views: 11000, publishedAt: "2026-08-12" }),
      obs({ id: "c", views: 10000, publishedAt: "2026-08-14" }),
    ];
    const analyses = detectPostPerformanceAnalyses(rows, [
      {
        campaignHeaderId: "camp-1",
        assignmentDeliverableId: "ad-weak",
        contractedSlots: 4,
        agreedFee: 2000,
        currency: "AED",
      },
    ]);
    const weak = analyses.find((row) => row.publicationId === "weak");
    assert.equal(weak?.verdict, "underperforming");
    assert.match(weak?.advice ?? "", /working harder than it should/i);
  });

  it("does not invent a fee for extra-platform posts", () => {
    const rows = [
      obs({
        id: "tt",
        assignmentDeliverableId: null,
        platform: "tiktok",
        publicationType: "tiktok_video",
        views: 50000,
      }),
    ];
    const analyses = detectPostPerformanceAnalyses(rows, []);
    assert.equal(analyses[0]?.feeAmount, null);
    assert.equal(analyses[0]?.extraDelivery, true);
    assert.equal(analyses[0]?.verdict, "collecting");
  });
});
