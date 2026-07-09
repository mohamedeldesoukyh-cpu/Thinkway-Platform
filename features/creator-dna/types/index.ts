/**
 * ERS-4 — Creator DNA types.
 * Canonical intelligence layer keyed by influencers.id.
 */

import type { RawProviderPayload } from "@/lib/intelligence-persistence/types";

/** Source priority: manual > campaign > oauth > ipl > ai_infer */
export type DnaSource =
  | "manual"
  | "campaign"
  | "oauth"
  | "ipl"
  | "ai_infer";

export const DNA_SOURCE_PRIORITY: Record<DnaSource, number> = {
  manual: 5,
  campaign: 4,
  oauth: 3,
  ipl: 2,
  ai_infer: 1,
};

export type FieldHistoryEntry<T> = {
  value: T;
  confidence: number;
  source: DnaSource;
  sourceVersion?: string | number | null;
  updatedAt: string;
  snapshotId?: string | null;
};

/** Envelope for every intelligent field in Creator DNA. */
export type FieldEnvelope<T> = {
  value: T;
  confidence: number;
  source: DnaSource;
  sourceVersion?: string | number | null;
  updatedAt: string;
  history: FieldHistoryEntry<T>[];
};

export type CreatorDNAIdentity = {
  displayName: FieldEnvelope<string | null>;
  bio: FieldEnvelope<string | null>;
  avatarUrl: FieldEnvelope<string | null>;
  handle: FieldEnvelope<string | null>;
  platform: FieldEnvelope<string | null>;
  isVerified: FieldEnvelope<boolean | null>;
};

export type CreatorDNAMetrics = {
  followers: FieldEnvelope<number | null>;
  following: FieldEnvelope<number | null>;
  postsCount: FieldEnvelope<number | null>;
  engagementRate: FieldEnvelope<number | null>;
  avgLikes: FieldEnvelope<number | null>;
  avgComments: FieldEnvelope<number | null>;
  avgViews: FieldEnvelope<number | null>;
};

export type AudienceGenderSplit = {
  male: number;
  female: number;
};

export type CreatorDNAAudience = {
  country: FieldEnvelope<string | null>;
  countries: FieldEnvelope<string[]>;
  cities: FieldEnvelope<string[]>;
  languages: FieldEnvelope<string[]>;
  categories: FieldEnvelope<string[]>;
  hashtags: FieldEnvelope<string[]>;
  mentions: FieldEnvelope<string[]>;
  interests: FieldEnvelope<string[]>;
  /** Requires demographics provider — never Apify-invented. */
  audienceGender: FieldEnvelope<AudienceGenderSplit | null>;
  audienceAgeBands: FieldEnvelope<Record<string, number> | null>;
  audienceCities: FieldEnvelope<string[]>;
  languagePrimary: FieldEnvelope<string | null>;
};

export type CreatorDNAPlatforms = {
  primaryPlatform: FieldEnvelope<string | null>;
  accountCount: FieldEnvelope<number | null>;
  crossPlatformReach: FieldEnvelope<number | null>;
};

export type CreatorDNACommercial = {
  estimatedRate: FieldEnvelope<number | null>;
  typicalDeliverables: FieldEnvelope<string[]>;
  campaignFrequency: FieldEnvelope<string | null>;
  responseSpeed: FieldEnvelope<string | null>;
  historicalBrandCategories: FieldEnvelope<string[]>;
  previousCompetitors: FieldEnvelope<string[]>;
  exclusivity: FieldEnvelope<string | null>;
};

export type CreatorDNABrandSafety = {
  sensitiveTopics: FieldEnvelope<string[]>;
  politicalRisk: FieldEnvelope<string | null>;
  adultContent: FieldEnvelope<boolean | null>;
  copyrightIssues: FieldEnvelope<boolean | null>;
  fakeFollowers: FieldEnvelope<number | null>;
  engagementQuality: FieldEnvelope<number | null>;
  verificationLevel: FieldEnvelope<string | null>;
};

export type CreatorDNAHistoricalPerformance = {
  campaignsCompleted: FieldEnvelope<number | null>;
  avgCampaignRoi: FieldEnvelope<number | null>;
  repeatBrandRate: FieldEnvelope<number | null>;
  onTimeDeliveryRate: FieldEnvelope<number | null>;
  avgEngagementTrend: FieldEnvelope<number | null>;
};

export type CreatorDNAContact = {
  email: FieldEnvelope<string | null>;
  phone: FieldEnvelope<string | null>;
  links: FieldEnvelope<string[]>;
};

/** Apify-sourced content signals (recent posts, profile URL). */
export type CreatorDNAContent = {
  profileUrl: FieldEnvelope<string | null>;
  username: FieldEnvelope<string | null>;
  recentPublications: FieldEnvelope<
    Array<{
      url: string | null;
      thumbnail: string | null;
      likes: number | null;
      comments: number | null;
      views: number | null;
      posted_at: string | null;
      caption: string | null;
    }>
  >;
};

export type CreatorDNAScores = {
  thinkwayScore: FieldEnvelope<number | null>;
  brandFit: FieldEnvelope<number | null>;
  authenticityScore: FieldEnvelope<number | null>;
  aiCategory: FieldEnvelope<string | null>;
  aiNiche: FieldEnvelope<string | null>;
};

/** Intelligence provenance — append-only history on every merge. */
export type DnaIntelligenceSource =
  | "baseline_import"
  | "apify_enrichment"
  | "manual_update"
  | "campaign_learning"
  | "api_provider";

/** Creator maturity — advances forward except ARCHIVED. */
export type CreatorDnaLifecycle =
  | "IMPORTED"
  | "BASELINE"
  | "ENRICHED"
  | "ACTIVE"
  | "STRATEGIC"
  | "ARCHIVED";

export const DNA_LIFECYCLE_RANK: Record<CreatorDnaLifecycle, number> = {
  IMPORTED: 1,
  BASELINE: 2,
  ENRICHED: 3,
  ACTIVE: 4,
  STRATEGIC: 5,
  ARCHIVED: 6,
};

export type CreatorDNAMeta = {
  lastSnapshotId: string | null;
  lastEnrichmentRunId: string | null;
  platformAccountIds: string[];
  documentVersion: number;
  lastMergedAt: string | null;
  /** Latest Apify run id merged from IPL snapshot. */
  apifyRunId: string | null;
  /** Provider that sourced the latest IPL merge. */
  provider: string | null;
  /** IPL snapshot fetch timestamp. */
  fetchedAt: string | null;
  /** Append-only intelligence source history. */
  sources: DnaIntelligenceSource[];
  /** Most recent intelligence merge source. */
  lastMergeSource: DnaIntelligenceSource | null;
  /** ISO timestamp of most recent intelligence merge (alias: lastMergeDate). */
  lastMergeDate: string | null;
  /** When new intelligence was last learned — not the same as row updated_at. */
  lastIntelligenceUpdate: string | null;
  /** Creator maturity for refresh rules and prioritization. */
  lifecycle: CreatorDnaLifecycle;
};

export type CreatorDNADocument = {
  identity: CreatorDNAIdentity;
  platforms: CreatorDNAPlatforms;
  metrics: CreatorDNAMetrics;
  audience: CreatorDNAAudience;
  contact: CreatorDNAContact;
  content: CreatorDNAContent;
  commercial: CreatorDNACommercial;
  brandSafety: CreatorDNABrandSafety;
  historicalPerformance: CreatorDNAHistoricalPerformance;
  scores: CreatorDNAScores;
  meta: CreatorDNAMeta;
};

/** Merge tier — Verified > Imported > Inferred > Empty */
export type DnaMergeTier = "verified" | "imported" | "inferred" | "empty";

export const DNA_SOURCE_TIER: Record<DnaSource, DnaMergeTier> = {
  manual: "verified",
  campaign: "verified",
  oauth: "verified",
  ipl: "imported",
  ai_infer: "inferred",
};

export const DNA_TIER_PRIORITY: Record<DnaMergeTier, number> = {
  verified: 4,
  imported: 3,
  inferred: 2,
  empty: 1,
};

export type DnaCompletenessDimension =
  | "identity"
  | "platforms"
  | "audience"
  | "categories"
  | "content"
  | "commercial"
  | "quality"
  | "historicalPerformance";

export type DnaCompletenessResult = {
  dnaCompleteness: number;
  dimensionScores: Record<DnaCompletenessDimension, number>;
  missingFields: string[];
  verificationRequired: string[];
};

export type CreatorDNARecord = {
  influencerId: string;
  document: CreatorDNADocument;
  version: number;
  lastSnapshotId: string | null;
  lastEnrichmentRunId: string | null;
  platformAccountIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreatorDNAStagingRecord = {
  id: string;
  discoveredProfileId: string;
  document: CreatorDNADocument;
  version: number;
  lastSnapshotId: string | null;
  platformAccountId: string | null;
  promotedToInfluencerId: string | null;
  promotedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DnaFieldCandidate<T> = {
  path: string;
  value: T;
  confidence: number;
  source: DnaSource;
  sourceVersion?: string | number | null;
  updatedAt: string;
  snapshotId?: string | null;
};

export type MergeEvidenceInput = {
  snapshotId?: string | null;
  fields: DnaFieldCandidate<unknown>[];
  rawApifySnapshot?: RawProviderPayload | null;
  apifyRunId?: string | null;
  enrichedAt?: string | null;
};

export type { RawProviderPayload };

export type CreatorDNAVersionRecord = {
  id: string;
  influencerId: string;
  version: number;
  document: CreatorDNADocument;
  changeReason: string;
  changedFields: string[];
  snapshotId: string | null;
  createdAt: string;
};

export type LineageEventType =
  | "ipl_snapshot_merge"
  | "reprocess_merge"
  | "manual_update"
  | "staging_promotion"
  | "ai_score_merge"
  | "baseline_population";

export type BaselineDnaContext = {
  influencerId: string;
  isImport: boolean;
  influencerStatus: string;
  hasCampaignHistory: boolean;
  hasEnrichmentSnapshot: boolean;
};

export class CreatorDnaMandatoryError extends Error {
  constructor(
    public readonly influencerId: string,
    message: string
  ) {
    super(message);
    this.name = "CreatorDnaMandatoryError";
  }
}
