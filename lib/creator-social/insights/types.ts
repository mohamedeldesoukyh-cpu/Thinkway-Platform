import type { SocialProviderId } from "../ids";

export type SocialInsightKind = "account" | "content";

export type SocialMatchStatus = "unmatched" | "matched" | "uncertain";

export type NormalizedSocialInsight = {
  provider: SocialProviderId;
  insightKind: SocialInsightKind;
  externalContentId: string | null;
  canonicalUrl: string | null;
  publishedAt: string | null;
  contentType: string | null;
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagementRate: number | null;
  followers: number | null;
};

export type PublicationMatchCandidate = {
  id: string;
  influencerId: string;
  platform: string | null;
  contentUrl: string | null;
  externalMediaId: string | null;
};

export type PublicationMatchResult = {
  publicationId: string | null;
  matchStatus: SocialMatchStatus;
};
