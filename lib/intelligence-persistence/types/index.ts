/**
 * Sprint 8.5 — Intelligence Persistence Layer types.
 */

import type { ApifyProfileData } from "@/lib/creator-enrichment/types";

/** Supported external enrichment providers. Extensible for Sprint 9+. */
export type IplProvider = "apify" | "modash" | "hypeauditor" | "creatoriq" | "open_graph";

export type IplFieldGroup = "profile" | "metrics" | "content" | "contact" | "all";

export type IplProviderRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cached";

export type IplReprocessStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type IplReprocessJobType = "category_inference" | "brand_fit" | "niche_classification";

/** Provider-agnostic normalized profile snapshot stored in IPL. */
export type NormalizedProfileSnapshot = ApifyProfileData & {
  provider: IplProvider;
  fetchedAt: string;
  snapshotVersion?: number;
};

/** Immutable raw payload as received from provider before normalization. */
export type RawProviderPayload = {
  profileRows: Record<string, unknown>[];
  postRows: Record<string, unknown>[];
  apifyRunId?: string | null;
  detailsRunId?: string | null;
  postsRunId?: string | null;
  platformKey: string;
  profileUrl: string;
  username: string | null;
};

export type IplRefreshPolicy = {
  id: string;
  provider: string;
  fieldGroup: IplFieldGroup;
  ttlDays: number;
  followerTierOverrides: Record<string, number>;
  isActive: boolean;
};

export type IplSnapshotRecord = {
  id: string;
  providerRunId: string | null;
  influencerId: string | null;
  platformAccountId: string | null;
  discoveredProfileId: string | null;
  provider: IplProvider;
  platform: string;
  profileUrl: string | null;
  snapshotVersion: number;
  rawSnapshot: RawProviderPayload;
  normalizedSnapshot: NormalizedProfileSnapshot;
  snapshotType: string;
  fetchedAt: string;
  expiresAt: string | null;
  isLatest: boolean;
  auditMetadata: Record<string, unknown>;
};

export type IplProviderRunRecord = {
  id: string;
  provider: IplProvider;
  externalRunId: string | null;
  status: IplProviderRunStatus;
  influencerId: string | null;
  platformAccountId: string | null;
  discoveredProfileId: string | null;
  platform: string | null;
  profileUrl: string | null;
  creditsUsed: number | null;
  durationMs: number | null;
  estimatedCostUsd: number | null;
  payloadBytes: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
};

export type IplFetchContext = {
  influencerId: string;
  platformAccountId?: string | null;
  discoveredProfileId?: string | null;
  platform: string;
  username: string | null;
  profileUrl: string;
  force?: boolean;
  followerCount?: number | null;
  auditMetadata?: Record<string, unknown>;
  /** When false, skip Instagram posts actor (metrics refresh uses details.latestPosts). */
  includePosts?: boolean;
  /** When true, persistSnapshot skips DNA bridge — caller awaits bridge after post-processing. */
  deferDnaBridge?: boolean;
};

export type IplFetchResult =
  | {
      ok: true;
      data: ApifyProfileData;
      source: "cache" | "provider";
      snapshotId: string | null;
      providerRunId: string | null;
      cacheHit: boolean;
    }
  | {
      ok: false;
      reason: string;
      available: boolean;
      providerRunId: string | null;
    };

export type IplReprocessResult = {
  ok: boolean;
  jobId: string;
  status: IplReprocessStatus;
  categories?: string[];
  message: string;
};
