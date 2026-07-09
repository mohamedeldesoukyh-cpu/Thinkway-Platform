/** Shared types for batch profile acquisition (Apify → import → DNA). */

import type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";
import type { EnrichmentTrigger } from "@/lib/creator-enrichment/types";
import type { SocialPlatform } from "@/lib/social/platforms";

export type BatchProfileTarget = {
  unifiedId: string;
  platform: SocialPlatform;
  username: string;
  profileUrl: string;
  influencerId: string | null;
  discoveredProfileId: string | null;
  platformAccountId: string | null;
};

export type BatchProfileAcquisitionJobData = {
  jobId: string;
  targets: BatchProfileTarget[];
  trigger: EnrichmentTrigger;
  scope?: EnrichmentScope;
  requestedBy?: string | null;
  uploadAvatars?: boolean;
};

export type BatchProfileAcquisitionProgress = {
  acquisition_mode: "batch_profile";
  status: "running" | "completed" | "failed";
  creators_total: number;
  creators_imported: number;
  creators_merged: number;
  creators_failed: number;
  creators_skipped: number;
  batches_total: number;
  batches_completed: number;
  current_batch: number | null;
  apify_runs: string[];
  estimated_apify_runs: number;
  estimated_credits: number;
  actual_credits_estimate: number;
  platforms: Record<
    string,
    {
      batches_completed: number;
      batches_total: number;
      creators_processed: number;
    }
  >;
  errors: string[];
};

export type BatchProfileAcquisitionResult = {
  ok: boolean;
  jobId: string;
  creatorsTotal: number;
  creatorsImported: number;
  creatorsMerged: number;
  creatorsFailed: number;
  creatorsSkipped: number;
  apifyRunIds: string[];
  estimatedCredits: number;
  reason: string;
  progress: BatchProfileAcquisitionProgress;
};
