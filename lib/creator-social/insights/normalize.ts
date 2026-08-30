import type { SocialProviderId } from "../ids";
import type { NormalizedSocialInsight } from "./types";

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function createEmptyInsight(
  provider: SocialProviderId,
  insightKind: NormalizedSocialInsight["insightKind"]
): NormalizedSocialInsight {
  return {
    provider,
    insightKind,
    externalContentId: null,
    canonicalUrl: null,
    publishedAt: null,
    contentType: null,
    views: null,
    reach: null,
    impressions: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    engagementRate: null,
    followers: null,
  };
}

/** Copy only values the provider actually returned. Never fill missing metrics with zeros. */
export function normalizeProviderInsight(
  provider: SocialProviderId,
  insightKind: NormalizedSocialInsight["insightKind"],
  raw: {
    externalContentId?: unknown;
    canonicalUrl?: unknown;
    publishedAt?: unknown;
    contentType?: unknown;
    views?: unknown;
    reach?: unknown;
    impressions?: unknown;
    likes?: unknown;
    comments?: unknown;
    shares?: unknown;
    saves?: unknown;
    engagementRate?: unknown;
    followers?: unknown;
  }
): NormalizedSocialInsight {
  return {
    ...createEmptyInsight(provider, insightKind),
    externalContentId:
      typeof raw.externalContentId === "string" ? raw.externalContentId : null,
    canonicalUrl: typeof raw.canonicalUrl === "string" ? raw.canonicalUrl : null,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
    contentType: typeof raw.contentType === "string" ? raw.contentType : null,
    views: asNullableNumber(raw.views),
    reach: asNullableNumber(raw.reach),
    impressions: asNullableNumber(raw.impressions),
    likes: asNullableNumber(raw.likes),
    comments: asNullableNumber(raw.comments),
    shares: asNullableNumber(raw.shares),
    saves: asNullableNumber(raw.saves),
    engagementRate: asNullableNumber(raw.engagementRate),
    followers: asNullableNumber(raw.followers),
  };
}
