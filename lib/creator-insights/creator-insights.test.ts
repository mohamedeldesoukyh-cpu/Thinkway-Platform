import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assembleCreatorInsightPack, selectSurfacedInsights } from "./assemble";
import { wordingIntroducesUnknownNumbers } from "./ai-wording";
import {
  fingerprintCreatorInsightInputs,
  invalidateCreatorInsightCache,
  readCreatorInsightCache,
  writeCreatorInsightCache,
} from "./cache";
import { contentFormatFamily } from "./content-format";
import { applyStalePrefix, deterministicCopy } from "./copy";
import {
  detectEngagementOpportunity,
  detectPerformanceTrend,
  detectPublicationTiming,
  detectStrongContentType,
  detectCampaignSpecific,
  detectDataEnrichment,
  detectUnitCompactInsights,
} from "./detect";
import {
  mergeNullableMetrics,
  observationFromPublication,
  overlayMatchedSocialInsight,
  preferPresent,
  type CreatorPublicationObservation,
} from "./observations";
import { meanOfPresent, percentChange, presentCount } from "./stats";
import type { DetectedCreatorInsight } from "./types";
import { MAX_SURFACED_RECOMMENDATIONS } from "./types";

const CREATOR_A = "creator-a";
const CREATOR_B = "creator-b";

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

function dated(id: string, day: string, extra: Partial<CreatorPublicationObservation> = {}) {
  return obs({
    id,
    publishedAt: day,
    updatedAt: `${day}T12:00:00.000Z`,
    ...extra,
  });
}

async function detWording(insight: DetectedCreatorInsight, stale: boolean) {
  const copy = deterministicCopy(insight);
  return {
    copy: {
      ...copy,
      explanation: applyStalePrefix(
        copy.explanation,
        stale && insight.type !== "data_enrichment"
      ),
    },
    source: "deterministic" as const,
  };
}

describe("Normalized metrics", () => {
  it("leaves unsupported metrics null instead of fabricating zeros", () => {
    const merged = mergeNullableMetrics({ likes: 12 }, { views: null, likes: null });
    assert.equal(merged.likes, 12);
    assert.equal(merged.views, null);
    assert.equal(merged.comments, null);
    assert.equal(meanOfPresent([null, null, undefined]), null);
    assert.equal(presentCount([null, 0, null]), 1);
    assert.equal(preferPresent(null, null), null);
    assert.equal(percentChange(20, 0), null);
  });

  it("does not convert a missing Thinkway metric into zero when overlaying social data", () => {
    const base = observationFromPublication({
      id: "pub-1",
      influencerId: CREATOR_A,
      campaignHeaderId: "camp-1",
      assignmentDeliverableId: "ad-1",
      assignmentPostScheduleId: null,
      platform: "tiktok",
      publicationType: "tiktok_video",
      contentUrl: "https://tiktok.com/@x/video/1",
      publicationDate: "2026-08-01",
      status: "published",
      updatedAt: "2026-08-01T00:00:00.000Z",
      views: 4000,
      reach: null,
      impressions: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      engagementRate: null,
    });
    const overlay = overlayMatchedSocialInsight(base, { views: 4200, likes: 90 });
    assert.equal(overlay.views, 4200);
    assert.equal(overlay.likes, 90);
    assert.equal(overlay.engagementRate, null);
    assert.equal(overlay.reach, null);
    assert.equal(overlay.assignmentDeliverableId, "ad-1");
    assert.equal(overlay.influencerId, CREATOR_A);
  });
});

describe("Baselines and insight detection", () => {
  it("does not invent a trend from one publication", () => {
    assert.equal(detectPerformanceTrend([obs({ id: "only", views: 9000 })]), null);
  });

  it("detects an above-baseline views trend with a 5 vs 5 window", () => {
    const rows: CreatorPublicationObservation[] = [];
    for (let i = 0; i < 10; i += 1) {
      const day = `2026-08-${String(20 - i).padStart(2, "0")}`;
      rows.push(
        dated(`t${i}`, day, {
          views: i < 5 ? 200 : 100,
          publicationType: "instagram_reel",
        })
      );
    }
    const trend = detectPerformanceTrend(rows);
    assert.ok(trend);
    assert.equal(trend.type, "performance_trend");
    assert.equal(trend.facts.trend, "up");
    assert.equal(trend.facts.recentMean, 200);
    assert.equal(trend.facts.priorMean, 100);
    assert.equal(trend.evidence.length >= 2, true);
  });

  it("compares content types without requiring Instagram engagement rate on TikTok", () => {
    const rows = [
      ...Array.from({ length: 4 }, (_, i) =>
        dated(`tt${i}`, `2026-08-${10 + i}`, {
          platform: "tiktok",
          publicationType: "tiktok_video",
          views: 40000,
          engagementRate: null,
        })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        dated(`ig${i}`, `2026-08-0${i + 1}`, {
          platform: "instagram",
          publicationType: "instagram_post",
          views: 8000,
          engagementRate: null,
        })
      ),
    ];
    const strong = detectStrongContentType(rows);
    assert.ok(strong);
    assert.equal(strong.formatFamily, "short_video");
    assert.equal(strong.facts.metricKey, "views");
    assert.equal(strong.facts.comparisonFamily, "static_post");
  });

  it("requires a meaningful sample before a timing pattern", () => {
    const few = [
      dated("a", "2026-08-03", { views: 100 }),
      dated("b", "2026-08-10", { views: 120 }),
    ];
    assert.equal(detectPublicationTiming(few), null);
    const many = [
      dated("m1", "2026-08-03", { views: 300 }),
      dated("m2", "2026-08-10", { views: 310 }),
      dated("m3", "2026-08-17", { views: 290 }),
      dated("t1", "2026-08-04", { views: 80 }),
      dated("t2", "2026-08-05", { views: 90 }),
      dated("t3", "2026-08-06", { views: 70 }),
      dated("t4", "2026-08-07", { views: 85 }),
      dated("t5", "2026-08-11", { views: 75 }),
    ];
    const timing = detectPublicationTiming(many);
    assert.ok(timing);
    assert.equal(timing.facts.strongestWeekday, "Monday");
    assert.match(deterministicCopy(timing).explanation, /pattern|Monday/i);
    assert.doesNotMatch(deterministicCopy(timing).explanation, /causes higher/i);
  });

  it("detects strong views with weaker comments", () => {
    const rows: CreatorPublicationObservation[] = [];
    for (let i = 0; i < 10; i += 1) {
      rows.push(
        dated(`e${i}`, `2026-08-${String(20 - i).padStart(2, "0")}`, {
          views: i < 5 ? 5000 : 2000,
          comments: i < 5 ? 4 : 12,
        })
      );
    }
    const opportunity = detectEngagementOpportunity(rows);
    assert.ok(opportunity);
    assert.equal(opportunity.type, "engagement_opportunity");
  });

  it("attaches a campaign recommendation only to the creator's upcoming matching unit", () => {
    const rows = [
      ...Array.from({ length: 4 }, (_, i) =>
        dated(`r${i}`, `2026-08-1${i}`, {
          publicationType: "instagram_reel",
          views: 20000,
        })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        dated(`p${i}`, `2026-07-1${i}`, {
          publicationType: "instagram_post",
          views: 4000,
        })
      ),
    ];
    const rec = detectCampaignSpecific(rows, [
      {
        campaignHeaderId: "camp-9",
        assignmentDeliverableId: "ad-next",
        assignmentPostScheduleId: null,
        deliverableType: "instagram_reel",
        platform: "instagram",
        status: "to_do",
        label: "Reel 2",
      },
    ]);
    assert.ok(rec);
    assert.equal(rec.campaignHeaderId, "camp-9");
    assert.equal(rec.assignmentDeliverableId, "ad-next");
  });
});

describe("Recommendations", () => {
  it("does not surface a recommendation without evidence", async () => {
    const pack = await assembleCreatorInsightPack({
      influencerId: CREATOR_A,
      observations: [obs({ id: "one", views: 50 })],
      connections: [],
      hasOperationalHistory: true,
      wording: detWording,
    });
    const performance = pack.recommendations.filter((row) => row.type !== "data_enrichment");
    assert.equal(performance.length, 0);
    assert.ok(pack.recommendations.every((row) => row.evidence.length > 0));
  });

  it("caps surfaced recommendations at 1–3 and keeps ownership on the creator", async () => {
    const rows: CreatorPublicationObservation[] = [];
    for (let i = 0; i < 10; i += 1) {
      rows.push(
        dated(`v${i}`, `2026-08-${String(20 - i).padStart(2, "0")}`, {
          views: i < 5 ? 5000 : 2000,
          comments: i < 5 ? 4 : 20,
          publicationType: i % 2 === 0 ? "instagram_reel" : "instagram_post",
        })
      );
    }
    const pack = await assembleCreatorInsightPack({
      influencerId: CREATOR_A,
      observations: [
        ...rows,
        dated("b1", "2026-08-01", { influencerId: CREATOR_B, views: 999999 }),
      ],
      connections: [],
      hasOperationalHistory: true,
      wording: detWording,
    });
    assert.ok(pack.recommendations.length <= MAX_SURFACED_RECOMMENDATIONS);
    assert.ok(pack.recommendations.length >= 1);
    assert.ok(pack.recommendations.every((row) => row.influencerId === CREATOR_A));
    assert.equal(pack.influencerId, CREATOR_A);
    assert.equal(
      pack.recommendations.some((row) => String(row.facts.recentMean ?? "") === "999999"),
      false
    );
  });

  it("rejects AI wording that invents metrics and keeps structured facts authoritative", () => {
    const insight = detectPerformanceTrend(
      Array.from({ length: 10 }, (_, i) =>
        dated(`a${i}`, `2026-08-${String(20 - i).padStart(2, "0")}`, {
          views: i < 5 ? 200 : 100,
        })
      )
    );
    assert.ok(insight);
    const invented = {
      title: "You reached 999999 views",
      explanation: "Ignore the facts.",
      recommendation: "Do this.",
    };
    assert.equal(wordingIntroducesUnknownNumbers(invented, insight.facts), true);
    const copy = deterministicCopy(insight);
    assert.equal(copy.explanation.includes("999999"), false);
    assert.equal(insight.facts.recentMean, 200);
  });

  it("gives a disconnected creator Thinkway-only intelligence and a connected creator richer data", async () => {
    const thinkwayOnly = await assembleCreatorInsightPack({
      influencerId: CREATOR_A,
      observations: [],
      connections: [],
      hasOperationalHistory: true,
      wording: detWording,
    });
    assert.equal(thinkwayOnly.dataLevel, 0);
    assert.equal(thinkwayOnly.recommendations[0]?.type, "data_enrichment");

    const socialRows = Array.from({ length: 10 }, (_, i) =>
      dated(`s${i}`, `2026-08-${String(20 - i).padStart(2, "0")}`, {
        source: "social_content",
        matchStatus: "unmatched",
        platform: "tiktok",
        publicationType: "tiktok_video",
        views: i < 5 ? 900 : 400,
      })
    );
    const connected = await assembleCreatorInsightPack({
      influencerId: CREATOR_A,
      observations: socialRows,
      connections: [
        {
          provider: "tiktok",
          displayName: "TikTok",
          status: "connected",
          lastSyncedAt: "2026-08-30T00:00:00.000Z",
        },
      ],
      hasOperationalHistory: true,
      now: new Date("2026-08-30T12:00:00.000Z"),
      wording: detWording,
    });
    assert.equal(connected.dataLevel, 2);
    assert.equal(
      connected.recommendations.some((row) => row.type === "performance_trend"),
      true
    );
  });

  it("does not pretend stale platform data is current", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      dated(`st${i}`, `2026-08-${String(20 - i).padStart(2, "0")}`, {
        source: "merged",
        views: i < 5 ? 300 : 100,
      })
    );
    const pack = await assembleCreatorInsightPack({
      influencerId: CREATOR_A,
      observations: rows,
      connections: [
        {
          provider: "instagram",
          displayName: "Instagram",
          status: "connected",
          lastSyncedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      hasOperationalHistory: true,
      now: new Date("2026-08-30T00:00:00.000Z"),
      wording: detWording,
    });
    assert.equal(pack.stale, true);
    const trend = pack.recommendations.find((row) => row.type === "performance_trend");
    assert.ok(trend);
    assert.match(trend.explanation, /latest synced data/i);
  });

  it("surfaces a compact unit insight when a publication beats the creator baseline", () => {
    const rows = [
      dated("hero", "2026-08-20", {
        assignmentDeliverableId: "ad-hero",
        publicationType: "instagram_reel",
        views: 50000,
      }),
      ...Array.from({ length: 6 }, (_, i) =>
        dated(`base${i}`, `2026-08-${String(10 + i).padStart(2, "0")}`, {
          assignmentDeliverableId: `ad-b${i}`,
          publicationType: "instagram_reel",
          views: 10000,
        })
      ),
    ];
    const compact = detectUnitCompactInsights(rows);
    assert.ok(compact.some((row) => row.assignmentDeliverableId === "ad-hero"));
  });
});

describe("Cache fingerprint", () => {
  it("invalidates when the sync stamp changes", () => {
    const influencerId = CREATOR_A;
    const first = fingerprintCreatorInsightInputs({
      influencerId,
      publicationStamp: "p1",
      insightStamp: "i1",
      syncStamp: "s1",
      unitStamp: "u1",
    });
    writeCreatorInsightCache(influencerId, first, {
      influencerId,
      generatedAt: "2026-08-30T00:00:00.000Z",
      dataLevel: 1,
      dataAvailabilityLabel: "Thinkway publication metrics",
      stale: false,
      lastSyncedAt: "s1",
      sourceDataTimestamp: "p1",
      connectedPlatforms: [],
      recommendations: [],
      unitInsights: [],
      postAnalyses: [],
      collectingMessage: null,
    });
    assert.ok(readCreatorInsightCache(influencerId, first));
    const second = fingerprintCreatorInsightInputs({
      influencerId,
      publicationStamp: "p1",
      insightStamp: "i1",
      syncStamp: "s2",
      unitStamp: "u1",
    });
    assert.equal(readCreatorInsightCache(influencerId, second), null);
    invalidateCreatorInsightCache(influencerId);
    assert.equal(readCreatorInsightCache(influencerId, first), null);
  });
});

describe("selectSurfacedInsights", () => {
  it("never returns more than three recommendations", () => {
    const fake = (type: DetectedCreatorInsight["type"], priority: number): DetectedCreatorInsight => ({
      type,
      confidence: "medium",
      facts: { sampleSize: 8 },
      evidence: [{ label: "Sample", value: "8" }],
      sampleSize: 8,
      metricKey: "views",
      campaignHeaderId: null,
      assignmentDeliverableId: null,
      formatFamily: "short_video",
      platform: null,
      priority,
    });
    const selected = selectSurfacedInsights([
      fake("campaign_specific", 100),
      fake("performance_trend", 90),
      fake("strong_content_type", 80),
      fake("engagement_opportunity", 70),
      fake("publication_timing", 50),
      fake("data_enrichment", 10),
    ]);
    assert.equal(selected.length <= 3, true);
    assert.equal(selected.some((row) => row.type === "campaign_specific"), true);
  });
});
