/**
 * Default empty Creator DNA document factory.
 */

import { createEmptyEnvelope } from "./field-envelope";
import type { CreatorDNADocument } from "../types";

function emptyAudience() {
  return {
    country: createEmptyEnvelope<string | null>(null),
    countries: createEmptyEnvelope<string[]>([]),
    cities: createEmptyEnvelope<string[]>([]),
    languages: createEmptyEnvelope<string[]>([]),
    categories: createEmptyEnvelope<string[]>([]),
    hashtags: createEmptyEnvelope<string[]>([]),
    mentions: createEmptyEnvelope<string[]>([]),
    interests: createEmptyEnvelope<string[]>([]),
    audienceGender: createEmptyEnvelope<{ male: number; female: number } | null>(null),
    audienceAgeBands: createEmptyEnvelope<Record<string, number> | null>(null),
    audienceCities: createEmptyEnvelope<string[]>([]),
    languagePrimary: createEmptyEnvelope<string | null>(null),
  };
}

function emptyContent() {
  return {
    profileUrl: createEmptyEnvelope<string | null>(null),
    username: createEmptyEnvelope<string | null>(null),
    recentPublications: createEmptyEnvelope<
      Array<{
        url: string | null;
        thumbnail: string | null;
        likes: number | null;
        comments: number | null;
        views: number | null;
        posted_at: string | null;
        caption: string | null;
      }>
    >([]),
  };
}

function emptyCommercial() {
  return {
    estimatedRate: createEmptyEnvelope<number | null>(null),
    typicalDeliverables: createEmptyEnvelope<string[]>([]),
    campaignFrequency: createEmptyEnvelope<string | null>(null),
    responseSpeed: createEmptyEnvelope<string | null>(null),
    historicalBrandCategories: createEmptyEnvelope<string[]>([]),
    previousCompetitors: createEmptyEnvelope<string[]>([]),
    exclusivity: createEmptyEnvelope<string | null>(null),
  };
}

function emptyBrandSafety() {
  return {
    sensitiveTopics: createEmptyEnvelope<string[]>([]),
    politicalRisk: createEmptyEnvelope<string | null>(null),
    adultContent: createEmptyEnvelope<boolean | null>(null),
    copyrightIssues: createEmptyEnvelope<boolean | null>(null),
    fakeFollowers: createEmptyEnvelope<number | null>(null),
    engagementQuality: createEmptyEnvelope<number | null>(null),
    verificationLevel: createEmptyEnvelope<string | null>(null),
  };
}

function emptyHistoricalPerformance() {
  return {
    campaignsCompleted: createEmptyEnvelope<number | null>(null),
    avgCampaignRoi: createEmptyEnvelope<number | null>(null),
    repeatBrandRate: createEmptyEnvelope<number | null>(null),
    onTimeDeliveryRate: createEmptyEnvelope<number | null>(null),
    avgEngagementTrend: createEmptyEnvelope<number | null>(null),
  };
}

function emptyPlatforms() {
  return {
    primaryPlatform: createEmptyEnvelope<string | null>(null),
    accountCount: createEmptyEnvelope<number | null>(null),
    crossPlatformReach: createEmptyEnvelope<number | null>(null),
  };
}

export function createEmptyCreatorDNADocument(): CreatorDNADocument {
  return {
    identity: {
      displayName: createEmptyEnvelope<string | null>(null),
      bio: createEmptyEnvelope<string | null>(null),
      avatarUrl: createEmptyEnvelope<string | null>(null),
      handle: createEmptyEnvelope<string | null>(null),
      platform: createEmptyEnvelope<string | null>(null),
      isVerified: createEmptyEnvelope<boolean | null>(null),
    },
    platforms: emptyPlatforms(),
    metrics: {
      followers: createEmptyEnvelope<number | null>(null),
      following: createEmptyEnvelope<number | null>(null),
      postsCount: createEmptyEnvelope<number | null>(null),
      engagementRate: createEmptyEnvelope<number | null>(null),
      avgLikes: createEmptyEnvelope<number | null>(null),
      avgComments: createEmptyEnvelope<number | null>(null),
      avgViews: createEmptyEnvelope<number | null>(null),
    },
    audience: emptyAudience(),
    contact: {
      email: createEmptyEnvelope<string | null>(null),
      phone: createEmptyEnvelope<string | null>(null),
      links: createEmptyEnvelope<string[]>([]),
    },
    content: emptyContent(),
    commercial: emptyCommercial(),
    brandSafety: emptyBrandSafety(),
    historicalPerformance: emptyHistoricalPerformance(),
    scores: {
      thinkwayScore: createEmptyEnvelope<number | null>(null),
      brandFit: createEmptyEnvelope<number | null>(null),
      authenticityScore: createEmptyEnvelope<number | null>(null),
      aiCategory: createEmptyEnvelope<string | null>(null),
      aiNiche: createEmptyEnvelope<string | null>(null),
    },
    meta: {
      lastSnapshotId: null,
      lastEnrichmentRunId: null,
      platformAccountIds: [],
      documentVersion: 0,
      lastMergedAt: null,
      apifyRunId: null,
      provider: null,
      fetchedAt: null,
      sources: [],
      lastMergeSource: null,
      lastMergeDate: null,
      lastIntelligenceUpdate: null,
      lifecycle: "BASELINE",
    },
  };
}

export function parseCreatorDNADocument(raw: unknown): CreatorDNADocument {
  const empty = createEmptyCreatorDNADocument();
  if (raw == null || typeof raw !== "object") return empty;
  const doc = raw as Partial<CreatorDNADocument>;
  return {
    identity: { ...empty.identity, ...(doc.identity ?? {}) },
    platforms: { ...empty.platforms, ...(doc.platforms ?? {}) },
    metrics: { ...empty.metrics, ...(doc.metrics ?? {}) },
    audience: { ...empty.audience, ...(doc.audience ?? {}) },
    contact: { ...empty.contact, ...(doc.contact ?? {}) },
    content: { ...empty.content, ...(doc.content ?? {}) },
    commercial: { ...empty.commercial, ...(doc.commercial ?? {}) },
    brandSafety: { ...empty.brandSafety, ...(doc.brandSafety ?? {}) },
    historicalPerformance: {
      ...empty.historicalPerformance,
      ...(doc.historicalPerformance ?? {}),
    },
    scores: { ...empty.scores, ...(doc.scores ?? {}) },
    meta: {
      ...empty.meta,
      ...(doc.meta ?? {}),
      sources: (doc.meta as CreatorDNADocument["meta"] | undefined)?.sources ?? [],
      lifecycle:
        (doc.meta as CreatorDNADocument["meta"] | undefined)?.lifecycle ?? empty.meta.lifecycle,
    },
  };
}
